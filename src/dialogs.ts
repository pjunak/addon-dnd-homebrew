import type { Translator } from "./catalogs.js";
import { actionButton, configureDialog, element } from "./fields.js";

/** One way to close a dialog other than cancelling it. */
export interface Choice {
  readonly value: string;
  readonly label: string;
  readonly variant?: "primary" | "danger";
}

/**
 * A modal review: resolves to the chosen value, or undefined when the dialog
 * is closed or cancelled. Without choices it only informs.
 */
export function choiceDialog(
  host: HTMLElement,
  t: Translator,
  title: string,
  body: HTMLElement,
  choices: readonly Choice[],
): Promise<string | undefined> {
  const document = host.ownerDocument;
  return new Promise((resolve) => {
    const dialog = element(document, "dialog", "hb-dialog");
    const heading = element(document, "h2", "", title);
    heading.id = `hb-dialog-${crypto.randomUUID()}`;
    dialog.setAttribute("aria-labelledby", heading.id);
    let settled = false;
    const finish = (choice: string | undefined): void => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(choice);
    };
    const header = element(document, "header", "hb-dialog-header");
    header.append(
      heading,
      actionButton(document, t("Close"), () => finish(undefined)),
    );
    const actions = element(document, "div", "hb-dialog-actions");
    actions.dataset["uiActions"] = "";
    const cancel = actionButton(document, choices.length > 0 ? t("Cancel") : t("Close"), () =>
      finish(undefined),
    );
    actions.append(cancel);
    // Focus starts on the last choice that destroys nothing.
    let initial = cancel;
    for (const choice of choices) {
      const button = actionButton(
        document,
        choice.label,
        () => finish(choice.value),
        choice.variant ?? "",
      );
      if (choice.variant !== "danger") initial = button;
      actions.append(button);
    }
    dialog.append(header, body, actions);
    configureDialog(dialog, () => finish(undefined));
    host.append(dialog);
    dialog.showModal();
    initial.focus();
  });
}

/**
 * A modal review: resolves true when the DM confirms, false when the dialog is
 * closed or cancelled. Without a confirm label it only informs.
 */
export async function openDialog(
  host: HTMLElement,
  t: Translator,
  title: string,
  body: HTMLElement,
  confirmLabel?: string,
): Promise<boolean> {
  const choices = confirmLabel
    ? [{ value: "confirm", label: confirmLabel, variant: "primary" as const }]
    : [];
  return (await choiceDialog(host, t, title, body, choices)) === "confirm";
}

export function confirmDialog(
  host: HTMLElement,
  t: Translator,
  message: string,
  confirmLabel: string,
): Promise<boolean> {
  const body = element(host.ownerDocument, "div", "hb-dialog-body");
  body.append(element(host.ownerDocument, "p", "", message));
  return openDialog(host, t, confirmLabel, body, confirmLabel);
}
