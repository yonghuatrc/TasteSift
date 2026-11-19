import { cookies } from "next/headers";
import { languageFromValue } from "./i18n.ts";

export async function getLanguage() {
  return languageFromValue((await cookies()).get("tastesift-language")?.value);
}
