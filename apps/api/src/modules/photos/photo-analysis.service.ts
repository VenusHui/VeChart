import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import {
  AnalysisConfidence,
  BomItem,
  CostBreakdown,
  PhotoAnalysisStatus,
  PhotoRecord,
  ProductMetadata,
  SuggestedProductMetadata
} from '../../common/types';
import { PostgresRepository } from '../../data/postgres.repository';

interface SourceDigest {
  label: string;
  url: string;
  title: string | null;
  description: string | null;
  material: string | null;
  moq: number | null;
  prices: number[];
  excerpt: string | null;
}

interface AnalysisResult {
  provider: string;
  confidence: AnalysisConfidence | null;
  reasoningSummary: string | null;
  sources: string[];
  suggestedMetadata: SuggestedProductMetadata;
  snapshot: Record<string, unknown>;
}

const MATERIAL_KEYWORDS = [
  '头层牛皮',
  '牛皮',
  '真皮',
  'PU',
  'PVC',
  '帆布',
  '尼龙',
  '涤纶',
  '棉麻',
  '合金',
  '不锈钢',
  '黄铜',
  '银',
  '木质',
  '亚克力',
  '硅胶',
  '树脂',
  'ABS'
];

const COST_METHODOLOGY = [
  '【成本分析原则】',
  '1. 全成本覆盖：计入物料、人工、损耗、包装、运费、税费、模具分摊，不能只算物料。',
  '2. 批量定价：estimatedCost=中批量(500-1000件)，estimatedCostMin=大批量(5000+)，estimatedCostMax=小批量(100件)。',
  '3. 标准损耗率：亚克力切割/印刷5-8%，金属件2-3%，人工组装2-4%，包装1-2%。',
  '4. 先拆BOM→估裸价→加损耗→加人工→加包装→分摊固定成本→加物流税费→分批量汇总。',
  '5. 常见参考：亚克力挂件大批量¥1.5-4/小批量¥4-8，醋酸抓夹大批量¥5-18/小批量¥12-35，马口铁徽章大批量¥0.5-1.5/小批量¥2-4。',
  '6. 零售价marketPrice通常为综合成本的2-5倍。不确定时宁低勿高，设为null的字段不要编造。',
  '7. 尺寸估算：根据图片中参照物（手掌、桌面、常见物品）估算产品大致尺寸，格式如"4cm*4cm"或"19cm×9cm"（单位cm）。不确定时设为null，不要编造。',
  '8. 是否开模（moldRequired）：亚克力件、金属件、合金件、注塑件、树脂件通常需要开模（"是"）；布料缝制、帆布、纸质、硅胶成型通常不需要开模（"否"）。结合产品类型和材质判断。',
  '9. 打样/生产时间估算：无需开模产品打样3-7天，大货15-25天；需开模产品打样15-20天，开模7-30天（简单模具7-15天，复杂模具15-45天），大货25-60天。批量越大交货时间越长。',
  '10. MOQ与价格关系：MOQ越大单价越低。例如MOQ=500时单价可能比MOQ=100时低15-25%，MOQ=5000时可能再低10-15%。estimatedCostMin应对应大批量、estimatedCostMax应对应小批量。'
].join('\n');

const OUTPUT_SCHEMA = [
  '输出 JSON（不要markdown）：',
  '{"confidence":"low|medium|high","reasoningSummary":"分析依据","sources":[],"productName":"商品名","material":"材质","productUrl":null,"product1688Url":null,"marketPrice":零售价数字,"estimatedCost":中批量成本,"estimatedCostMin":大批量成本,"estimatedCostMax":小批量成本,"moq":起订量,"note":"备注","estimatedSize":"预估尺寸如4cm*4cm","samplingTime":打样天数,"moldRequired":"是|否","moldTime":开模天数或null,"bulkProductionTime":大货天数,"bomBreakdown":[{"part":"部件","material":"材质","unitCost":单价,"lossRate":"损耗率"}],"costBreakdown":{"materialCost":物料成本,"laborCost":人工,"packagingCost":包装,"fixedCostPerUnit":固定分摊,"logisticsCost":物流,"taxCost":税费},"suggestedMetadata":{"productName":"同上","material":"同上","productUrl":null,"product1688Url":null,"marketPrice":"同上","estimatedCost":"同上","estimatedCostMin":"同上","estimatedCostMax":"同上","moq":"同上","note":"同上","estimatedSize":"同上","samplingTime":"同上","moldRequired":"同上","moldTime":"同上","bulkProductionTime":"同上"}}'
].join('\n');

@Injectable()
export class PhotoAnalysisService implements OnModuleInit {
  private readonly logger = new Logger(PhotoAnalysisService.name);
  private readonly inFlight = new Set<string>();
  private readonly claudeApiKey: string | null;
  private readonly claudeModel: string;
  private readonly claudeBaseUrl: string;
  private readonly openAiApiKey: string | null;
  private readonly openAiModel: string;
  private readonly openAiBaseUrl: string;

  constructor(
    private readonly repository: PostgresRepository,
    private readonly configService: ConfigService
  ) {
    this.claudeApiKey = this.configService.get<string>('CLAUDE_API_KEY')?.trim() || null;
    this.claudeModel = this.configService.get<string>('CLAUDE_MODEL', 'claude-opus-4-6');
    this.claudeBaseUrl = this.configService.get<string>('CLAUDE_BASE_URL', 'https://claude.api.ceo-tech.cn');
    this.openAiApiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim() || null;
    this.openAiModel = this.configService.get<string>('OPENAI_ANALYSIS_MODEL', 'gpt-4.1-mini');
    this.openAiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  }

  async onModuleInit() {
    const pendingPhotos = await this.repository.listPhotosByAnalysisStatuses(['pending', 'running']);
    for (const photo of pendingPhotos) {
      this.enqueuePhotoAnalysis(photo.id);
    }
  }

  enqueuePhotoAnalysis(photoId: string) {
    if (this.inFlight.has(photoId)) {
      return;
    }
    this.inFlight.add(photoId);
    setTimeout(() => {
      void this.runPhotoAnalysis(photoId).finally(() => {
        this.inFlight.delete(photoId);
      });
    }, 0);
  }

  async requestPhotoAnalysis(photoId: string) {
    const photo = await this.repository.requestPhotoAnalysis(photoId);
    this.enqueuePhotoAnalysis(photoId);
    return photo;
  }

  async analyzePhotoForExport(
    photo: PhotoRecord,
    unifiedMoq: number | null
  ): Promise<{
    suggestedMetadata: SuggestedProductMetadata;
    confidence: AnalysisConfidence | null;
    reasoningSummary: string | null;
  }> {
    const digests = await this.collectSourceDigests(photo);

    let result: AnalysisResult;
    try {
      if (this.claudeApiKey) {
        result = await this.runClaudeAnalysis(photo, digests, unifiedMoq);
      } else if (this.openAiApiKey) {
        result = await this.runOpenAiAnalysis(photo, digests, unifiedMoq);
      } else {
        result = this.runHeuristicAnalysis(photo, digests, 'heuristic', unifiedMoq);
      }
    } catch (error) {
      this.logger.warn(
        `Export analysis failed for ${photo.id}, falling back to heuristics: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      result = this.runHeuristicAnalysis(photo, digests, 'heuristic-fallback', unifiedMoq);
    }

    return {
      suggestedMetadata: result.suggestedMetadata,
      confidence: result.confidence,
      reasoningSummary: result.reasoningSummary
    };
  }

  private async runPhotoAnalysis(photoId: string) {
    let provider: string;
    if (this.claudeApiKey) {
      provider = 'claude';
    } else if (this.openAiApiKey) {
      provider = 'openai-responses';
    } else {
      provider = 'heuristic';
    }

    try {
      await this.repository.markPhotoAnalysisRunning(photoId, provider);
      const photo = await this.repository.getPhoto(photoId);
      const digests = await this.collectSourceDigests(photo);

      let result: AnalysisResult;
      try {
        if (this.claudeApiKey) {
          result = await this.runClaudeAnalysis(photo, digests);
        } else if (this.openAiApiKey) {
          result = await this.runOpenAiAnalysis(photo, digests);
        } else {
          result = this.runHeuristicAnalysis(photo, digests, 'heuristic');
        }
      } catch (error) {
        this.logger.warn(
          `Primary analysis failed for ${photoId}, falling back to heuristics: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        result = this.runHeuristicAnalysis(photo, digests, 'heuristic-fallback');
      }

      await this.repository.markPhotoAnalysisSucceeded(photoId, result);
    } catch (error) {
      this.logger.error(`Photo analysis failed for ${photoId}`, error as Error);
      await this.repository.markPhotoAnalysisFailed(
        photoId,
        provider,
        error instanceof Error ? error.message : '分析失败'
      );
    }
  }

  private async collectSourceDigests(photo: PhotoRecord) {
    const candidates = [
      photo.metadata.productUrl
        ? { label: '产品链接', url: photo.metadata.productUrl }
        : null,
      photo.metadata.product1688Url
        ? { label: '1688 链接', url: photo.metadata.product1688Url }
        : null
    ].filter(Boolean) as Array<{ label: string; url: string }>;

    const digests = await Promise.all(candidates.map((candidate) => this.fetchSourceDigest(candidate.label, candidate.url)));
    return digests.filter((item): item is SourceDigest => Boolean(item));
  }

  private async fetchSourceDigest(label: string, url: string): Promise<SourceDigest | null> {
    if (!/^https?:\/\//i.test(url)) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 VeChartBot/1.0',
          Accept: 'text/html,application/xhtml+xml'
        },
        redirect: 'follow',
        signal: controller.signal
      });

      if (!response.ok) {
        return null;
      }

      const html = (await response.text()).slice(0, 60000);
      const normalized = this.normalizeText(this.stripHtml(html)).slice(0, 2500);
      return {
        label,
        url,
        title: this.extractTagContent(html, 'title'),
        description: this.extractMetaDescription(html),
        material: this.extractMaterial(normalized),
        moq: this.extractMoq(normalized),
        prices: this.extractPrices(normalized),
        excerpt: normalized || null
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async runClaudeAnalysis(photo: PhotoRecord, digests: SourceDigest[], unifiedMoq: number | null = null): Promise<AnalysisResult> {
    const moqLine = unifiedMoq != null ? `\n统一 MOQ: ${unifiedMoq} 件（客户设定的整批起订量，请基于此批量估算成本，MOQ 字段请返回此值）\n` : '';
    const systemPrompt = [
      '你是专业的文创/小商品成本分析选品助理。请根据商品图片与补充网页信息，输出结构化的商品分析 JSON。',
      '',
      COST_METHODOLOGY,
      moqLine,
      '',
      OUTPUT_SCHEMA,
      '',
      `当前草稿 metadata：${JSON.stringify(photo.metadata)}`,
      `网页摘要 digests：${JSON.stringify(digests)}`
    ].filter(Boolean).join('\n');

    const imageBlock = await this.fetchImageBase64(photo.imageUrl);

    const contentBlocks: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: '请根据图片和 system prompt 中的方法论，对商品进行成本分析并输出 JSON。先拆解BOM，再计算各层级成本，最后汇总输出。即使无法精确判断所有字段，也要基于图片视觉特征给出合理估算。'
      }
    ];

    if (imageBlock) {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageBlock.mediaType,
          data: imageBlock.data
        }
      });
    }

    const response = await fetch(`${this.claudeBaseUrl.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.claudeApiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.claudeModel,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: contentBlocks }
        ]
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Claude analysis request failed');
    }

    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const textContent = payload.content?.find((c) => c.type === 'text')?.text;
    if (!textContent) {
      throw new Error('Claude analysis returned an empty response');
    }

    const cleaned = textContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = this.parseJsonObject(cleaned);
    if (!parsed) {
      throw new Error('Claude analysis response contained no valid JSON object');
    }

    const nestedMeta = (parsed.suggestedMetadata as Record<string, unknown> | undefined) ?? {};

    const rawSuggestion: SuggestedProductMetadata = {
      productName: (nestedMeta.productName ?? parsed.productName ?? null) as string | null,
      material: (nestedMeta.material ?? parsed.material ?? null) as string | null,
      productUrl: (nestedMeta.productUrl ?? parsed.productUrl ?? null) as string | null,
      product1688Url: (nestedMeta.product1688Url ?? parsed.product1688Url ?? null) as string | null,
      marketPrice: this.parseNumber(nestedMeta.marketPrice ?? parsed.marketPrice),
      estimatedCost: this.parseNumber(nestedMeta.estimatedCost ?? parsed.estimatedCost),
      estimatedCostMin: this.parseNumber(nestedMeta.estimatedCostMin ?? parsed.estimatedCostMin),
      estimatedCostMax: this.parseNumber(nestedMeta.estimatedCostMax ?? parsed.estimatedCostMax),
      moq: this.parseInteger(nestedMeta.moq ?? parsed.moq),
      note: (nestedMeta.note ?? parsed.note ?? null) as string | null,
      estimatedSize: (nestedMeta.estimatedSize ?? parsed.estimatedSize ?? null) as string | null,
      samplingTime: this.parseInteger(nestedMeta.samplingTime ?? parsed.samplingTime),
      moldRequired: ((nestedMeta.moldRequired ?? parsed.moldRequired ?? null) as string | null),
      moldTime: this.parseInteger(nestedMeta.moldTime ?? parsed.moldTime),
      bulkProductionTime: this.parseInteger(nestedMeta.bulkProductionTime ?? parsed.bulkProductionTime),
      bomBreakdown: (Array.isArray(nestedMeta.bomBreakdown)
        ? nestedMeta.bomBreakdown
        : Array.isArray(parsed.bomBreakdown)
          ? parsed.bomBreakdown
          : null) as BomItem[] | null,
      costBreakdown: (this.parseCostBreakdown(nestedMeta.costBreakdown) ?? this.parseCostBreakdown(parsed.costBreakdown))
    };

    const sanitized = this.sanitizeSuggestedMetadata(rawSuggestion, photo.metadata, digests);

    const conf = (parsed.confidence as AnalysisConfidence | null | undefined) ?? null;
    const summary = (parsed.reasoningSummary as string | null | undefined) ?? null;
    const srcs = Array.isArray(parsed.sources) ? (parsed.sources as string[]) : [];

    return {
      provider: 'claude',
      confidence: conf ?? this.computeConfidence({
        digests,
        material: sanitized.material,
        marketPrice: sanitized.marketPrice,
        supplierPrice: null
      }),
      reasoningSummary: summary,
      sources: srcs.length ? srcs : digests.map((item) => `${item.label}: ${item.title || item.url}`),
      suggestedMetadata: sanitized,
      snapshot: {
        mode: 'claude',
        model: this.claudeModel,
        imageAnalyzed: Boolean(imageBlock),
        digests,
        response: parsed
      }
    };
  }

  private readonly IMAGE_BUDGET = 600 * 1024;

  private readonly COMPRESSION_ATTEMPTS: Array<{ width: number; quality: number; chromaSubsampling: string }> = [
    { width: 2560, quality: 90, chromaSubsampling: '4:4:4' },
    { width: 2560, quality: 80, chromaSubsampling: '4:4:4' },
    { width: 2048, quality: 80, chromaSubsampling: '4:4:4' },
    { width: 2048, quality: 65, chromaSubsampling: '4:4:4' },
    { width: 1568, quality: 55, chromaSubsampling: '4:2:0' }
  ];

  private async fetchImageBase64(imageUrl: string) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const originalSize = arrayBuffer.byteLength;
      this.logger.log(`Image downloaded: ${originalSize} bytes from ${imageUrl}`);

      let bestResult: { data: string; mediaType: string; quality: number; width: number; size: number } | null = null;

      for (const attempt of this.COMPRESSION_ATTEMPTS) {
        const compressed = await sharp(arrayBuffer)
          .resize({ width: attempt.width, height: attempt.width, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: attempt.quality, chromaSubsampling: attempt.chromaSubsampling as '4:4:4' | '4:2:0' })
          .toBuffer();

        if (compressed.length <= this.IMAGE_BUDGET) {
          bestResult = {
            data: compressed.toString('base64'),
            mediaType: 'image/jpeg',
            quality: attempt.quality,
            width: attempt.width,
            size: compressed.length
          };
          break;
        }
      }

      if (!bestResult) {
        const compressed = await sharp(arrayBuffer)
          .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 45 })
          .toBuffer();
        bestResult = {
          data: compressed.toString('base64'),
          mediaType: 'image/jpeg',
          quality: 45,
          width: 1024,
          size: compressed.length
        };
      }

      this.logger.log(
        `Image compressed: ${originalSize} -> ${bestResult.size} bytes ` +
        `(quality=${bestResult.quality}, width=${bestResult.width})`
      );
      return { data: bestResult.data, mediaType: bestResult.mediaType };
    } catch (err) {
      this.logger.warn(`Failed to fetch/compress image: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private runHeuristicAnalysis(photo: PhotoRecord, digests: SourceDigest[], provider: string, unifiedMoq: number | null = null): AnalysisResult {
    const sourceText = digests
      .map((item) => [item.title, item.description, item.excerpt].filter(Boolean).join(' | '))
      .join(' | ');
    const material =
      this.firstNonEmpty([
        photo.metadata.material,
        ...digests.map((item) => item.material),
        this.extractMaterial(sourceText)
      ]) ?? null;
    const marketPrice = this.firstNumber([
      photo.metadata.marketPrice,
      this.selectRetailPrice(digests),
      this.extractPriceNearKeyword(sourceText, /(售价|零售价|市场价|价格)/)
    ]);
    const supplierPrice = this.firstNumber([
      this.extractPriceNearKeyword(sourceText, /(1688|批发价|拿货价|供货价)/),
      ...digests.flatMap((item) => item.prices)
    ]);
    const moq = unifiedMoq ?? this.firstInteger([photo.metadata.moq, ...digests.map((item) => item.moq), 50]);
    const title =
      this.firstNonEmpty([
        photo.metadata.productName,
        ...digests.map((item) => this.cleanTitle(item.title)),
        material ? `${material}商品待确认` : 'AI 待确认商品'
      ]) ?? 'AI 待确认商品';

    const costRange = this.estimateCostRange({ marketPrice, supplierPrice, material, moq });
    const confidence = this.computeConfidence({ digests, material, marketPrice, supplierPrice });
    const reasoningSummary = this.buildReasoningSummary({ material, marketPrice, supplierPrice, moq, digests, confidence });
    const moldReq = this.inferMoldRequired(material);
    const estimatedSize = this.extractEstimatedSize(sourceText, digests);

    return {
      provider,
      confidence,
      reasoningSummary,
      sources: digests.map((item) => `${item.label}: ${item.title || item.url}`),
      suggestedMetadata: {
        productName: title,
        material,
        productUrl: photo.metadata.productUrl || digests.find((item) => item.label === '产品链接')?.url || null,
        product1688Url:
          photo.metadata.product1688Url || digests.find((item) => item.label === '1688 链接')?.url || null,
        marketPrice,
        estimatedCost: costRange.mid,
        estimatedCostMin: costRange.min,
        estimatedCostMax: costRange.max,
        moq,
        note: reasoningSummary,
        estimatedSize,
        samplingTime: moldReq === '是' ? 20 : 7,
        moldRequired: moldReq,
        moldTime: moldReq === '是' ? 15 : null,
        bulkProductionTime: moq ? Math.max(15, Math.ceil(moq / 100)) : 30,
        bomBreakdown: null,
        costBreakdown: null
      },
      snapshot: {
        mode: 'heuristic',
        digests,
        inferred: {
          material,
          marketPrice,
          supplierPrice,
          moq,
          confidence
        }
      }
    };
  }

  private async runOpenAiAnalysis(photo: PhotoRecord, digests: SourceDigest[], unifiedMoq: number | null = null): Promise<AnalysisResult> {
    const moqLine = unifiedMoq != null ? `\n统一 MOQ: ${unifiedMoq} 件（客户设定的整批起订量，请基于此批量估算成本，MOQ 字段请返回此值）\n` : '';
    const prompt = [
      '你是产品选品助理。请根据商品图片与补充网页信息，输出结构化的商品建议字段。',
      '要求：',
      '1. 只输出 schema 要求的 JSON。',
      '2. 成本必须输出为区间和中位建议；如果不确定，降低 confidence。',
      '3. 所有建议值都要保守，不要编造过度具体的材质或价格。',
      '4. 若链接信息与图片冲突，以链接标题/材质为主，并在 reasoningSummary 中说明。',
      moqLine,
      `当前已知草稿：${JSON.stringify(photo.metadata)}`,
      `网页摘要：${JSON.stringify(digests)}`
    ].filter(Boolean).join('\n');

    const response = await fetch(`${this.openAiBaseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openAiApiKey}`
      },
      body: JSON.stringify({
        model: this.openAiModel,
        store: false,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: photo.imageUrl, detail: 'low' }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'product_analysis',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                confidence: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
                reasoningSummary: { type: ['string', 'null'] },
                sources: {
                  type: 'array',
                  items: { type: 'string' }
                },
                suggestedMetadata: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    productName: { type: ['string', 'null'] },
                    material: { type: ['string', 'null'] },
                    productUrl: { type: ['string', 'null'] },
                    product1688Url: { type: ['string', 'null'] },
                    marketPrice: { type: ['number', 'null'] },
                    estimatedCost: { type: ['number', 'null'] },
                    estimatedCostMin: { type: ['number', 'null'] },
                    estimatedCostMax: { type: ['number', 'null'] },
                    moq: { type: ['integer', 'null'] },
                    note: { type: ['string', 'null'] },
                    estimatedSize: { type: ['string', 'null'] },
                    samplingTime: { type: ['number', 'null'] },
                    moldRequired: { type: ['string', 'null'] },
                    moldTime: { type: ['number', 'null'] },
                    bulkProductionTime: { type: ['number', 'null'] }
                  },
                  required: [
                    'productName',
                    'material',
                    'productUrl',
                    'product1688Url',
                    'marketPrice',
                    'estimatedCost',
                    'estimatedCostMin',
                    'estimatedCostMax',
                    'moq',
                    'note',
                    'estimatedSize',
                    'samplingTime',
                    'moldRequired',
                    'moldTime',
                    'bulkProductionTime'
                  ]
                }
              },
              required: ['confidence', 'reasoningSummary', 'sources', 'suggestedMetadata']
            }
          }
        }
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'OpenAI analysis request failed');
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = this.extractResponseText(payload);
    if (!text) {
      throw new Error('OpenAI analysis returned an empty payload');
    }

    const parsed = JSON.parse(text) as {
      confidence: AnalysisConfidence | null;
      reasoningSummary: string | null;
      sources: string[];
      suggestedMetadata: SuggestedProductMetadata;
    };

    const sanitized = this.sanitizeSuggestedMetadata(parsed.suggestedMetadata, photo.metadata, digests);
    return {
      provider: 'openai-responses',
      confidence: parsed.confidence ?? this.computeConfidence({ digests, material: sanitized.material, marketPrice: sanitized.marketPrice, supplierPrice: null }),
      reasoningSummary: parsed.reasoningSummary,
      sources: parsed.sources?.length ? parsed.sources : digests.map((item) => `${item.label}: ${item.title || item.url}`),
      suggestedMetadata: sanitized,
      snapshot: {
        mode: 'openai',
        model: this.openAiModel,
        digests,
        response: parsed
      }
    };
  }

  private sanitizeSuggestedMetadata(
    input: SuggestedProductMetadata,
    current: ProductMetadata,
    digests: SourceDigest[]
  ): SuggestedProductMetadata {
    const heuristics = this.runHeuristicAnalysis(
      {
        id: 'sanitizer',
        albumId: '',
        imageUrl: '',
        thumbnailUrl: '',
        createdAt: '',
        updatedAt: '',
        createdBy: '',
        metadata: current,
        analysis: {
          status: 'pending',
          provider: null,
          confidence: null,
          reasoningSummary: null,
          sources: [],
          errorMessage: null,
          updatedAt: null,
          suggestedMetadata: null
        }
      },
      digests,
      'sanitizer'
    ).suggestedMetadata;

    return {
      productName: input.productName || heuristics.productName,
      material: input.material || heuristics.material,
      productUrl: input.productUrl || current.productUrl || heuristics.productUrl,
      product1688Url: input.product1688Url || current.product1688Url || heuristics.product1688Url,
      marketPrice: input.marketPrice ?? heuristics.marketPrice,
      estimatedCost: input.estimatedCost ?? heuristics.estimatedCost,
      estimatedCostMin: input.estimatedCostMin ?? heuristics.estimatedCostMin,
      estimatedCostMax: input.estimatedCostMax ?? heuristics.estimatedCostMax,
      moq: input.moq ?? heuristics.moq,
      note: input.note || heuristics.note,
      estimatedSize: input.estimatedSize || heuristics.estimatedSize,
      samplingTime: input.samplingTime ?? heuristics.samplingTime,
      moldRequired: input.moldRequired || heuristics.moldRequired,
      moldTime: input.moldTime ?? heuristics.moldTime,
      bulkProductionTime: input.bulkProductionTime ?? heuristics.bulkProductionTime,
      bomBreakdown: input.bomBreakdown ?? null,
      costBreakdown: input.costBreakdown ?? null
    };
  }

  private extractResponseText(payload: Record<string, unknown>): string | null {
    const direct = typeof payload.output_text === 'string' ? payload.output_text : null;
    if (direct) {
      return direct;
    }

    const output = Array.isArray(payload.output) ? payload.output : [];
    for (const item of output) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const content = Array.isArray((item as Record<string, unknown>).content)
        ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
        : [];
      for (const part of content) {
        const textValue = part.text;
        if (typeof textValue === 'string') {
          return textValue;
        }
      }
    }

    return null;
  }

  private estimateCostRange(input: {
    marketPrice: number | null;
    supplierPrice: number | null;
    material: string | null;
    moq: number | null;
  }) {
    if (input.supplierPrice !== null) {
      const min = this.roundCurrency(input.supplierPrice * 0.95);
      const max = this.roundCurrency(input.supplierPrice * 1.15);
      return { min, max, mid: this.roundCurrency((min + max) / 2) };
    }

    const materialFactor =
      input.material && /(牛皮|真皮|银|黄铜|不锈钢)/i.test(input.material)
        ? [0.34, 0.52]
        : input.material && /(帆布|PVC|亚克力|硅胶|树脂|ABS)/i.test(input.material)
          ? [0.2, 0.34]
          : [0.24, 0.42];

    const basePrice = input.marketPrice ?? 80;
    const moqDiscount = input.moq && input.moq >= 200 ? 0.94 : 1;
    const min = this.roundCurrency(basePrice * materialFactor[0] * moqDiscount);
    const max = this.roundCurrency(basePrice * materialFactor[1] * moqDiscount);
    return { min, max, mid: this.roundCurrency((min + max) / 2) };
  }

  private computeConfidence(input: {
    digests: SourceDigest[];
    material: string | null;
    marketPrice: number | null;
    supplierPrice: number | null;
  }): AnalysisConfidence {
    let score = 0;
    if (input.digests.length > 0) score += 1;
    if (input.material) score += 1;
    if (input.marketPrice !== null) score += 1;
    if (input.supplierPrice !== null) score += 1;

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private buildReasoningSummary(input: {
    material: string | null;
    marketPrice: number | null;
    supplierPrice: number | null;
    moq: number | null;
    digests: SourceDigest[];
    confidence: AnalysisConfidence;
  }) {
    const parts = [
      input.material ? `识别材质倾向为${input.material}` : '未拿到可靠材质证据',
      input.marketPrice !== null ? `市场售价参考 ¥${input.marketPrice}` : '未拿到明确零售价',
      input.supplierPrice !== null ? `供货侧价格参考 ¥${input.supplierPrice}` : '缺少明确供货价',
      input.moq !== null ? `MOQ 参考 ${input.moq}` : null,
      input.digests.length > 0 ? `已结合 ${input.digests.length} 个商品页摘要` : '仅基于现有图片/草稿信息估算',
      `置信度 ${input.confidence}`
    ].filter(Boolean);

    return parts.join('；');
  }

  private selectRetailPrice(digests: SourceDigest[]) {
    const prices = digests.flatMap((item) => item.prices).filter((value) => value >= 10);
    if (prices.length === 0) {
      return null;
    }
    return Math.max(...prices);
  }

  private extractPriceNearKeyword(text: string, keyword: RegExp) {
    const match = text.match(new RegExp(`${keyword.source}[^0-9]{0,8}(\\d+(?:\\.\\d{1,2})?)`, 'i'));
    if (!match) {
      return null;
    }
    return this.numberOrNull(match[1]);
  }

  private inferMoldRequired(material: string | null): string | null {
    if (!material) return null;
    if (/亚克力|合金|不锈钢|黄铜|银|树脂|ABS/i.test(material)) return '是';
    if (/帆布|尼龙|涤纶|棉麻|PVC|硅胶|PU布/i.test(material)) return '否';
    return null;
  }

  private extractEstimatedSize(text: string | null, digests: SourceDigest[]): string | null {
    if (text) {
      const sizeMatch = text.match(
        /(\d{1,3}\s*(?:cm|厘米|mm|毫米)?\s*[*×xX]\s*\d{1,3}\s*(?:cm|厘米|mm|毫米)?(?:\s*[*×xX]\s*\d{1,3}\s*(?:cm|厘米|mm|毫米)?)?)/i
      );
      if (sizeMatch) {
        return sizeMatch[1].replace(/厘米/g, 'cm').replace(/毫米/g, 'mm').replace(/\s+/g, '');
      }
    }
    for (const d of digests) {
      const found = this.extractEstimatedSize([d.title, d.description, d.excerpt].filter(Boolean).join(' | '), []);
      if (found) return found;
    }
    return null;
  }

  private extractMaterial(text: string | null) {
    if (!text) {
      return null;
    }
    const found = MATERIAL_KEYWORDS.find((keyword) => text.includes(keyword));
    return found ?? null;
  }

  private extractMoq(text: string | null) {
    if (!text) {
      return null;
    }
    const match = text.match(/(?:MOQ|最小起订量|起订量|起批量)[^0-9]{0,8}(\d{1,5})/i);
    return match ? Number(match[1]) : null;
  }

  private extractPrices(text: string | null) {
    if (!text) {
      return [];
    }
    const matches = [...text.matchAll(/(?:¥|￥|价格|售价|批发价|单价)?[^0-9]{0,6}(\d+(?:\.\d{1,2})?)/g)];
    return matches
      .map((match) => this.numberOrNull(match[1]))
      .filter((value): value is number => value !== null)
      .filter((value) => value >= 1 && value <= 50000)
      .slice(0, 10);
  }

  private extractTagContent(html: string, tagName: string) {
    const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
    return match ? this.normalizeText(match[1]).slice(0, 120) : null;
  }

  private extractMetaDescription(html: string) {
    const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    return match ? this.normalizeText(match[1]).slice(0, 200) : null;
  }

  private stripHtml(html: string) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
  }

  private normalizeText(value: string) {
    return value.replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();
  }

  private cleanTitle(value: string | null) {
    if (!value) {
      return null;
    }
    return value.replace(/[\-|｜_].*$/, '').trim() || null;
  }

  private firstNonEmpty(values: Array<string | null | undefined>) {
    return values.find((value) => typeof value === 'string' && value.trim()) ?? null;
  }

  private firstNumber(values: Array<number | null | undefined>) {
    const value = values.find((item) => typeof item === 'number' && Number.isFinite(item));
    return typeof value === 'number' ? this.roundCurrency(value) : null;
  }

  private firstInteger(values: Array<number | null | undefined>) {
    const value = values.find((item) => typeof item === 'number' && Number.isFinite(item) && item > 0);
    return typeof value === 'number' ? Math.round(value) : null;
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private parseJsonObject(text: string): Record<string, unknown> | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      if (ch === '"' && !escape) {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
          } catch {
            return null;
          }
        }
      }
    }

    return null;
  }

  private parseNumber(value: unknown): number | null {
    if (value === null || typeof value === 'undefined' || value === '') {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? this.roundCurrency(numeric) : null;
  }

  private parseInteger(value: unknown): number | null {
    const numeric = this.parseNumber(value);
    return numeric === null ? null : Math.round(numeric);
  }

  private parseCostBreakdown(value: unknown): CostBreakdown | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const r = value as Record<string, unknown>;
    return {
      materialCost: this.parseNumber(r.materialCost),
      laborCost: this.parseNumber(r.laborCost),
      packagingCost: this.parseNumber(r.packagingCost),
      fixedCostPerUnit: this.parseNumber(r.fixedCostPerUnit),
      logisticsCost: this.parseNumber(r.logisticsCost),
      taxCost: this.parseNumber(r.taxCost)
    };
  }

  private numberOrNull(value: unknown) {
    if (value === null || typeof value === 'undefined' || value === '') {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}
