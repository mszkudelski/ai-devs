1. take all reports from /data/pliki_z_fabryki
- only txt file
2. For each report:
    - ask chat from src/openaiservice to analyze report
    - pass content of one report at the time
    - pass content of facts from /data/pliki_z_fabryki
3. openai should return response in format <thinking> and <result>
4. result should be json of keyword from report
- like this:
{
"nazwa-pliku-01.txt":"lista, słów, kluczowych 1",
"nazwa-pliku-02.txt":"lista, słów, kluczowych 2",
"nazwa-pliku-03.txt":"lista, słów, kluczowych 3",
"nazwa-pliku-NN.txt":"lista, słów, kluczowych N"
}
5. send report with sendReport function
