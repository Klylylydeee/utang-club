import { z } from "zod";
import { objectIdSchema, optionalText, requiredText } from "./common";

export const createTabSchema = z.object({
  name: requiredText("Tab name", 80),
  description: optionalText(500),
});

export type CreateTabInput = z.infer<typeof createTabSchema>;

export const updateTabDetailsSchema = z.object({
  tabId: objectIdSchema,
  name: requiredText("Tab name", 80),
  description: optionalText(500),
});

export type UpdateTabDetailsInput = z.infer<typeof updateTabDetailsSchema>;

export const setTabArchivedSchema = z.object({
  tabId: objectIdSchema,
  archived: z.boolean(),
});

export type SetTabArchivedInput = z.infer<typeof setTabArchivedSchema>;
