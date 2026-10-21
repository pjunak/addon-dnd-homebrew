import type { Translator } from "./catalogs.js";
import { actionButton, configureDialog, element } from "./fields.js";

/**
 * A modal review: resolves true when the DM confirms, false when the dialog is
 * closed or cancelled. Without a confirm label it only informs.
 */
export function openDialog(
  host: HTMLElement,
  t: Translator,
  title: string,
  body: HTMLElement,
  confirmLabel?: string,
): Promise<boolean> {
  const document = host.ownerDocument;
  return new Promise((resolve) => {
    const dialog = element(document, "dialog", "hb-dialog");
    const heading = element(document, "h2", "", title);
    heading.id = `hb-dialog-${crypto.randomUUID()}`;
    dialog.setAttribute("aria-labelledby", heading.id);
    let settled = false;
    const finish = (confirmed: boolean): void => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(confirmed);
    };
    const header = element(document, "header", "hb-dialog-header");
    header.append(
      heading,
      actionButton(document, t("Close"), () => finish(false)),
    );
    const actions = element(document, "div", "hb-dialog-actions");
    actions.dataset["uiActions"] = "";
    actions.append(
      actionButton(document, confirmLabel ? t("Cancel") : t("Close"), () => finish(false)),
    );
    if (confirmLabel)
      actions.append(actionButton(document, confirmLabel, () => finish(true), "primary"));
    dialog.append(header, body, actions);
    configureDialog(dialog, () => finish(false));
    host.append(dialog);
    dialog.showModal();
    (actions.lastElementChild as HTMLElement | null)?.focus();
  });
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
