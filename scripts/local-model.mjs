export async function callLocalModel(systemPrompt, userPrompt, outputSchema, maxTokens = 2200, timeout = 120_000, fetcher = fetch, signal, temperature, reasoning = false) {
  const modelResponse = await fetcher("http://127.0.0.1:8081/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "unsloth/Qwen3.6-35B-A3B-GGUF",
      max_tokens: maxTokens,
      ...(temperature === undefined ? {} : { temperature }),
      chat_template_kwargs: { enable_thinking: reasoning },
      response_format: { type: "json_schema", json_schema: { name: "recipe_content", strict: true, schema: outputSchema } },
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
  });
  if (!modelResponse.ok) throw new Error("本机食谱整理程序暂时不可用。");
  const result = await modelResponse.json();
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("本机程序没有返回食谱。");
  return JSON.parse(content);
}
