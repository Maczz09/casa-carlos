import type { ComponentProps } from "react";
import { Button } from "./button.js";
import { cn } from "../lib/utils.js";

/** Tarjetas seleccionables y acciones propias de los módulos sobre Button de shadcn. */
export function ActionButton({ className, type = "button", ...props }: ComponentProps<"button">) {
  return <Button variant="ghost" type={type} className={cn("h-auto whitespace-normal rounded-xl p-0 text-inherit font-[inherit]", className)} {...props} />;
}
