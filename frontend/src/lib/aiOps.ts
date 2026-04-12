import type { KanbanOperation } from "@/lib/api";

type OperationActions = {
  renameColumn: (columnId: string, title: string) => Promise<void>;
  createCard: (columnId: string, title: string, details: string) => Promise<void>;
  updateCard: (cardId: string, fields: { title?: string; details?: string }) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  moveCard: (cardId: string, columnId: string, position: number) => Promise<void>;
};

export async function applyKanbanOperations(
  operations: KanbanOperation[],
  actions: OperationActions
): Promise<number> {
  let applied = 0;

  for (const op of operations) {
    if (op.action === "rename_column") {
      if (op.column_id && op.title?.trim()) {
        await actions.renameColumn(op.column_id, op.title.trim());
        applied += 1;
      }
      continue;
    }

    if (op.action === "create_card") {
      if (op.column_id && op.title?.trim()) {
        await actions.createCard(op.column_id, op.title.trim(), op.details ?? "");
        applied += 1;
      }
      continue;
    }

    if (op.action === "update_card") {
      const fields: { title?: string; details?: string } = {};
      if (op.title != null) fields.title = op.title;
      if (op.details != null) fields.details = op.details;
      if (op.card_id && Object.keys(fields).length > 0) {
        await actions.updateCard(op.card_id, fields);
        applied += 1;
      }
      continue;
    }

    if (op.action === "delete_card") {
      if (op.card_id) {
        await actions.deleteCard(op.card_id);
        applied += 1;
      }
      continue;
    }

    if (op.action === "move_card") {
      if (op.card_id && op.column_id) {
        await actions.moveCard(op.card_id, op.column_id, op.position ?? 0);
        applied += 1;
      }
    }
  }

  return applied;
}
