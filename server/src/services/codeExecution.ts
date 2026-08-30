export interface CodeExecutionRequest {
  sourceCode: string;
  languageId: number;
  stdin?: string;
}

export interface CodeExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  status: string;
}

export async function runCode(
  request: CodeExecutionRequest
): Promise<CodeExecutionResult> {
  const response = await fetch(
    "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source_code: request.sourceCode,
        language_id: request.languageId,
        stdin: request.stdin ?? ""
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("Judge0 error:", result);
    throw new Error(
      result.message ?? `Judge0 returned ${response.status}`
    );
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    compileOutput: result.compile_output ?? "",
    status: result.status?.description ?? "Unknown"
  };
}