import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { EXPORT_CACHE_HEADERS, exportNotFound, loadExportForRequest } from "@/lib/settlements/exportRequest";
import { buildShareModel, exportFileName, type ShareModel } from "@/lib/settlements/shareModel";

/**
 * The tab's settlement summary as a PNG for group chats (HANDOFF.md,
 * "Share as image"). Read-only, so the owner and admins may both fetch it.
 */

const fontDir = join(process.cwd(), "src/assets/fonts");
const [regular, semiBold] = await Promise.all([
  readFile(join(fontDir, "Geist-Regular.ttf")),
  readFile(join(fontDir, "Geist-SemiBold.ttf")),
]);

const WIDTH = 1080;
const COLORS = {
  shell: "#0f1a3c",
  shellMuted: "rgba(255,255,255,0.72)",
  surface: "#f4f5f7",
  raised: "#ffffff",
  ink: "#101828",
  inkSecondary: "#475467",
  separator: "rgba(16,24,40,0.12)",
  positive: "#12805c",
};

export async function GET(_request: Request, { params }: RouteContext<"/tabs/[tabId]/settlements/image">) {
  const data = await loadExportForRequest((await params).tabId);
  if (!data) return exportNotFound();

  const now = new Date();
  const model = buildShareModel(data.tabName, data.summary, now);
  return new ImageResponse(<ShareImage model={model} />, {
    width: WIDTH,
    height: imageHeight(model),
    fonts: [
      { name: "Geist", data: regular, weight: 400, style: "normal" },
      { name: "Geist", data: semiBold, weight: 600, style: "normal" },
    ],
    headers: {
      ...EXPORT_CACHE_HEADERS,
      "Content-Disposition": `inline; filename="${exportFileName(data.tabName, "png", now)}"`,
    },
  });
}

/** Satori needs a fixed height, so it grows with the number of lines. */
function imageHeight(model: ShareModel): number {
  const header = 236;
  const pairs = model.pairs.length === 0 ? 120 : 112 + model.pairs.length * 76 + (model.morePairs ? 56 : 0);
  const nets = model.nets.length === 0 ? 0 : 112 + model.nets.length * 64 + (model.morePeople ? 56 : 0);
  const footer = 120;
  return header + pairs + nets + footer;
}

function ShareImage({ model }: { model: ShareModel }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.surface,
        fontFamily: "Geist",
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          height: 236,
          padding: "0 64px 44px",
          backgroundColor: COLORS.shell,
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 26, color: COLORS.shellMuted, letterSpacing: 0.5 }}>Utang Club</div>
        <div style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.15, marginTop: 10 }}>{clip(model.tabName, 40)}</div>
        <div style={{ fontSize: 26, color: COLORS.shellMuted, marginTop: 8 }}>{model.asOf}</div>
      </div>

      <Section title="Who pays whom">
        {model.pairs.length === 0 ? (
          <div style={{ display: "flex", fontSize: 32, color: COLORS.inkSecondary, padding: "8px 0" }}>
            Everyone is square. Nothing is outstanding.
          </div>
        ) : (
          <List>
            {model.pairs.map((pair, index) => (
              <Row key={pair.key} first={index === 0} height={76}>
                <div style={{ display: "flex", alignItems: "center", fontSize: 32, flexShrink: 1, overflow: "hidden" }}>
                  <span>{clip(pair.from, 22)}</span>
                  <span style={{ color: COLORS.inkSecondary, margin: "0 18px" }}>→</span>
                  <span>{clip(pair.to, 22)}</span>
                </div>
                <div style={{ fontSize: 36, fontWeight: 600, marginLeft: 24 }}>{pair.amount}</div>
              </Row>
            ))}
          </List>
        )}
        {model.morePairs > 0 && <More count={model.morePairs} noun="pair" />}
      </Section>

      {model.nets.length > 0 && (
        <Section title="By person">
          <List>
            {model.nets.map((net, index) => (
              <Row key={net.key} first={index === 0} height={64}>
                <div style={{ display: "flex", fontSize: 30 }}>{clip(net.name, 30)}</div>
                <div style={{ display: "flex", alignItems: "baseline", fontSize: 30 }}>
                  <span style={{ color: net.verb === "gets back" ? COLORS.positive : COLORS.inkSecondary, marginRight: 14 }}>
                    {net.verb}
                  </span>
                  <span style={{ fontWeight: 600, color: net.verb === "gets back" ? COLORS.positive : COLORS.ink }}>
                    {net.amount}
                  </span>
                </div>
              </Row>
            ))}
          </List>
          {model.morePeople > 0 && <More count={model.morePeople} noun="person" plural="people" />}
        </Section>
      )}

      <div
        style={{
          display: "flex",
          marginTop: "auto",
          height: 120,
          alignItems: "center",
          padding: "0 64px",
          fontSize: 24,
          color: COLORS.inkSecondary,
        }}
      >
        {model.footer}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "40px 64px 0" }}>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: COLORS.inkSecondary, marginBottom: 20 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.raised,
        border: `1px solid ${COLORS.separator}`,
        borderRadius: 16,
        padding: "0 32px",
      }}
    >
      {children}
    </div>
  );
}

function Row({ first, height, children }: { first: boolean; height: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height,
        borderTop: first ? "none" : `1px solid ${COLORS.separator}`,
      }}
    >
      {children}
    </div>
  );
}

function More({ count, noun, plural }: { count: number; noun: string; plural?: string }) {
  return (
    <div style={{ display: "flex", height: 56, alignItems: "center", fontSize: 26, color: COLORS.inkSecondary }}>
      {`and ${count} more ${count === 1 ? noun : (plural ?? `${noun}s`)}`}
    </div>
  );
}

/** Long names would push amounts off the image; the app shows them in full. */
function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
