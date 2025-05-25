import { ChapterDetails } from "types";

let jwtToken: string | null = null;

export function setJwtToken(token: string) {
  jwtToken = token;
  console.log("✅ JWT token definido:", token);
}

export async function request(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  bodyOrParams?: any
): Promise<any> {
  if (!jwtToken) {
    throw new Error("JWT token não definido. Use setJwtToken() primeiro.");
  }

  let finalUrl = url;
  let fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `${jwtToken}`,
    }
  };

  if (method === "GET" && bodyOrParams) {
    const query = new URLSearchParams(bodyOrParams).toString();
    finalUrl += `?${query}`;
  } else if (bodyOrParams) {
    fetchOptions.body = JSON.stringify(bodyOrParams);
  }

  const response = await fetch(finalUrl, fetchOptions);

  if (!response.ok) {
    throw new Error(`Erro ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

export async function getChapter(id: string): Promise<ChapterDetails> {
  return await request("http://localhost:9090/chapter", "GET", { id });
}