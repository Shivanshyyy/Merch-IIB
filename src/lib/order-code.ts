import "server-only";
import { randomInt } from "node:crypto";
import { site } from "@/config/site";
import { ORDER_CODE_ALPHABET, ORDER_CODE_LENGTH } from "@/lib/schemas";

export function generateOrderCode() {
  let s = "";
  for (let i = 0; i < ORDER_CODE_LENGTH; i++) s += ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)];
  return `${site.orderCodePrefix}-${s}`;
}
