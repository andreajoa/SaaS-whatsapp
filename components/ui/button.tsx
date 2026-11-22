import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — Sage design system.
 * Variants:
 *   - primary (default): accent fill, branded CTA
 *   - secondary: surface-elevated com border, ação neutra
 *   - ghost: transparent, hover suave (toolbar/inline)
 *   - destructive: error fill (delete/cancel destrutivo)
 *   - outline: alias de secondary com background transparente (compat shadcn)
 *   - link: text-only com underline
 *   - default: alias de primary (compat shadcn)
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-sm font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform]",
    "duration-fast ease-out",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "border-2 border-neutral-900 bg-accent font-semibold text-accent-foreground shadow-[3px_3px_0_var(--color-neutral-900)] hover:-translate-y-0.5 hover:bg-accent-hover active:shadow-none dark:border-accent-200 dark:shadow-[3px_3px_0_rgba(0,0,0,0.65)]",
        default:
          "border-2 border-neutral-900 bg-accent font-semibold text-accent-foreground shadow-[3px_3px_0_var(--color-neutral-900)] hover:-translate-y-0.5 hover:bg-accent-hover active:shadow-none dark:border-accent-200 dark:shadow-[3px_3px_0_rgba(0,0,0,0.65)]",
        secondary:
          "bg-surface-elevated text-text border-2 border-border-strong hover:border-neutral-900 hover:bg-accent-soft hover:text-accent dark:hover:border-accent-300",
        outline:
          "bg-surface text-text border-2 border-border-strong hover:border-neutral-900 hover:bg-accent-soft hover:text-accent dark:hover:border-accent-300",
        ghost:
          "bg-transparent text-text hover:bg-accent-soft hover:text-accent",
        destructive:
          "border-2 border-neutral-900 bg-error font-semibold text-white shadow-[3px_3px_0_var(--color-neutral-900)] hover:brightness-95 active:shadow-none dark:border-error/60",
        link:
          "bg-transparent text-accent underline underline-offset-4 decoration-1 hover:decoration-2 h-auto p-0",
      },
      // Alturas de toque: abaixo de `lg` (mesmo corte que o resto da casca
      // usa pra decidir "é celular/tablet, é mouse") toda variante bate os
      // 44px recomendados pra alvo de toque; de `lg:` pra cima, onde quem
      // aciona é cursor, volta pro tamanho compacto original — mudar isso
      // globalmente pro app inteiro em telas grandes infla a densidade sem
      // necessidade nenhuma. `lg` já nascia com 44px e não precisou mudar.
      size: {
        sm: "h-11 px-3 text-xs lg:h-8",
        default: "h-11 px-4 text-sm lg:h-9",
        md: "h-11 px-4 text-sm lg:h-9",
        lg: "h-11 px-6 text-sm",
        icon: "h-11 w-11 lg:h-9 lg:w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
