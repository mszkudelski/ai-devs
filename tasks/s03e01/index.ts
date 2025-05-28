import fs from 'fs/promises';
import path from 'path';
import { OpenAIService } from '../../src/openai.service.js';
import { sendReport } from '../../src/report.js';

interface AnalysisResult {
  [filename: string]: string;
}

export class ReportAnalyzer {
  private openaiService: OpenAIService;
  private dataPath: string;
  private factsPath: string;

  constructor() {
    this.openaiService = new OpenAIService();
    this.dataPath = path.join(process.cwd(), 'data', 'pliki_z_fabryki');
    this.factsPath = path.join(this.dataPath, 'facts');
  }

  async getAllTxtReports(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dataPath);
      return files.filter((file) => file.endsWith('.txt') && !file.startsWith('facts'));
    } catch (error) {
      console.error('Error reading directory:', error);
      throw error;
    }
  }

  async readFactsContent(): Promise<string> {
    try {
      const factFiles = await fs.readdir(this.factsPath);
      const txtFactFiles = factFiles.filter((file) => file.endsWith('.txt'));

      const factContents = await Promise.all(
        txtFactFiles.map(async (file) => {
          const content = await fs.readFile(path.join(this.factsPath, file), 'utf-8');
          return `${file}:\n${content}`;
        })
      );

      return factContents.join('\n\n');
    } catch (error) {
      console.error('Error reading facts:', error);
      throw error;
    }
  }

  async analyzeReport(
    reportContent: string,
    factsContent: string,
    fileName: string
  ): Promise<string> {
    const prompt = `
Analizuj poniższy raport z fabryki i wyciągnij z niego słowa kluczowe na podstawie dostępnych faktów.

INSTRUKCJE:
- Zidentyfikuj kluczowe informacje: co się stało, gdzie, kto był zaangażowany, jakie przedmioty/technologie się pojawiły.
- Najczęstszym łącznikiem będą osoby wymienione w raporcie i w faktach.
- Jeśli są jakieś kluczowe informacje o osobie, to również je umieść w słówach kluczowych. Np. jeśli pojmana osoba była mechanikiem, to dołączyć jej nazwisko oraz zawód.
- Informacje mogą być rozproszone. Np. nazwisko pojawia się w raporcie, a zawód osoby w faktach.
- Jeśli dwie infomacje odnośnie osoby są kluczowe, to powinny być w osobnych słowach kluczowych. Np. "Jan Kowalski, mechanik", "Jan Kowalski, specjalista od broni".
- Jeśli w raporcie pojawia się osoba, a w "faktach" znajdują się informacje o tej osobie lub inne istotne szczegóły, muszą one trafić do słów kluczowych dla tego raportu.
- Powinieneś rozpoznać i poprawić literówkę np. w nazwisku osoby.
- Uwzględniaj nazwę pliku, bo tam też mogą być istotne informacje.

Fakty kontekstowe:
${factsContent}

Wyciągnij słowa kluczowe z tego raportu w formacie listy oddzielonej przecinkami. Skup się na najważniejszych informacjach takich jak lokalizacje, osoby, wydarzenia, sprzęt i procedury.

RAPORT DO ANALIZY: ${fileName}
${reportContent}

Odpowiedz w formacie:
<thinking>
1. Identyfikacja głównych elementów...
2. Sprawdzenie powiązania z faktami...
3. Połączenie informacji z raportu i faktów...
4. Selekcja najważniejszych słów...
</thinking>

<result>
słowo1, słowo2, słowo3...
</result>
`;

    try {
      const response = await this.openaiService.getChatResponse(prompt, 'gpt-4.1-mini');
      return this.extractResultContent(response);
    } catch (error) {
      console.error('Error analyzing report:', error);
      throw error;
    }
  }

  private extractResultContent(response: string): string {
    // First try to match properly closed <result> tags
    const closedResultMatch = response.match(/<result>(.*?)<\/result>/s);
    if (closedResultMatch) {
      return closedResultMatch[1].trim();
    }

    // Handle unclosed <result> tags - extract everything after <result>
    const unclosedResultMatch = response.match(/<result>\s*(.*)/s);
    if (unclosedResultMatch) {
      let content = unclosedResultMatch[1];

      // Remove any closing thinking tags that might be at the end
      content = content.replace(/<\/thinking>\s*$/s, '');

      return content.trim();
    }

    // If no result tags found, return the whole response
    return response.trim();
  }

  private testExtraction(): void {
    const testResponse = `<thinking>
  Raport dotyczy sektora C, lokalizacja to peryferie zachodnie, godzina 03:45. Patrol zakończony, brak anomalii, czujniki wykazały brak niepokojących sygnałów. W raporcie nie wymieniono bezpośrednio osób, ale można odnieść się do sektora C, znanego z testowania nowoczesnej broni, systemów bezpieczeństwa, techników i inżynierów. Kluczowe słowa to sektor C, patrol, czujniki, bezpieczeństwo. Brak w raporcie nazwisk lub sprzętu, więc kluczowe będą ogólne słowa o lokalizacji, procedurach, czasie.
  <result>
  sektor C, patrol, czujniki, bezpieczeństwo, zachodnie peryferie, godzina 03:45, brak anomalii, procedury monitoringu, technicy, inżynierowie`;

    const extracted = this.extractResultContent(testResponse);
    console.log('Test extraction result:', extracted);
  }

  async processAllReports(): Promise<AnalysisResult> {
    console.log('Starting report analysis...');

    const txtFiles = await this.getAllTxtReports();
    const factsContent = await this.readFactsContent();
    const results: AnalysisResult = {};

    console.log(`Found ${txtFiles.length} txt reports to analyze`);
    console.log('Loaded facts content for context');

    for (const filename of txtFiles) {
      try {
        console.log(`Analyzing ${filename}...`);

        const reportPath = path.join(this.dataPath, filename);
        const reportContent = await fs.readFile(reportPath, 'utf-8');

        const keywords = await this.analyzeReport(reportContent, factsContent, filename);
        results[filename] = keywords;

        console.log(`✓ ${filename}: ${keywords}`);

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing ${filename}:`, error);
        results[filename] = 'error during analysis';
      }
    }

    return results;
  }

  async runAnalysisAndSendReport(): Promise<void> {
    try {
      const analysisResults = await this.processAllReports();

      console.log('\nAnalysis complete. Results:');
      console.log(JSON.stringify(analysisResults, null, 2));

      console.log('\nSending report...');
      const response = await sendReport('dokumenty', analysisResults);

      console.log('Report sent successfully:', response);
    } catch (error) {
      console.error('Error in analysis workflow:', error);
      throw error;
    } finally {
      await this.openaiService.shutdown();
    }
  }
}

// Main execution
export async function main() {
  const analyzer = new ReportAnalyzer();

  // Test the extraction function first
  // console.log('Testing extraction function...');
  // (analyzer as any).testExtraction();
  //

  await analyzer.runAnalysisAndSendReport();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
