import { z } from "zod";

const DmPolicySchema = z.enum(["open", "pairing", "allowlist"]);
const GroupPolicySchema = z.enum(["open", "allowlist", "disabled"]);

export const DingTalkAccountConfigSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().optional(),
  clientId: z.string().describe("App clientId (AppKey)"),
  clientSecret: z.string().describe("App clientSecret (AppSecret)"),
  robotCode: z.string().optional().describe("Robot code for proactive messages"),
  dm: z
    .object({
      policy: DmPolicySchema.optional(),
      allowFrom: z.array(z.string()).optional().describe("Allowed user IDs for DM"),
    })
    .strict()
    .optional(),
  groupPolicy: GroupPolicySchema.optional(),
  groups: z
    .record(
      z.string(),
      z
        .object({
          enabled: z.boolean().optional(),
          requireMention: z.boolean().optional(),
          toolPolicy: z.string().optional(),
        })
        .strict(),
    )
    .optional(),
});

export const DingTalkConfigSchema = z.object({
  ...DingTalkAccountConfigSchema.shape,
  accounts: z.record(z.string(), DingTalkAccountConfigSchema).optional(),
});

export type DingTalkAccountConfig = z.infer<typeof DingTalkAccountConfigSchema>;
export type DingTalkConfig = z.infer<typeof DingTalkConfigSchema>;
