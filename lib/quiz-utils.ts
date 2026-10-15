export function generateRoomCode() {
  const digits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("");
  return digits;
}

export function gradeQuestionSubmission(
  question: { answer: string[]; type: string; points?: number },
  selected: string[],
) {
  const normalizedSelected = [...selected].map((value) => value.trim());
  const normalizedAnswer = [...question.answer].map((value) => value.trim());
  const points = question.points ?? 1;

  if (question.type === "multiple") {
    const correct = normalizedSelected.length === normalizedAnswer.length && normalizedSelected.every((item) => normalizedAnswer.includes(item));
    return { isCorrect: correct, score: correct ? points : 0 };
  }

  const answer = normalizedAnswer[0] ?? "";
  const selectedValue = normalizedSelected[0] ?? "";
  const isCorrect = answer.toLowerCase() === selectedValue.toLowerCase();
  return { isCorrect, score: isCorrect ? points : 0 };
}

export function buildCsv(rows: Array<Record<string, string | number | boolean>>) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const values = rows.map((row) =>
    headers
      .map((key) => JSON.stringify(String(row[key] ?? "")))
      .join(","),
  );

  return [headers.join(","), ...values].join("\n");
}
