import Link from "next/link";

/**
 * /grid — locked boot-screen placeholder. Mirrors wireframes/scan-grid-locked.html.
 * Renders OUTSIDE the (marketing) route group so it gets its own terminal chrome
 * instead of the topbar + footer + shiftbot strip.
 */
export default function GridLockedPage() {
  return (
    <>
      <style>{gridStyles}</style>
      <div className="scanlines" aria-hidden />

      <div className="sysbar">
        <div className="sb-left">
          <span>LASTPROOF v1.0</span>
          <span>NODE // MAINNET</span>
        </div>
        <div className="sb-right">
          <span className="orange">GRID // LOCKED</span>
          <span>SESSION // GUEST</span>
        </div>
      </div>

      <div className="terminal-frame">
        <div className="titlebar">
          <div className="tb-left">
            <div className="dots">
              <span className="r" />
              <span className="y" />
              <span className="g" />
            </div>
            <span className="title">boot — lastproof — 80×24</span>
          </div>
          <span className="title-right">PID 1</span>
        </div>

        <div className="tbody">
          <div className="inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/shiftbot-logo.png" alt="SHIFTBOT" />

            <div className="lines">
              <div className="line">LASTPROOF v1.0</div>
              <div className="line">Initializing system...</div>
              <div className="line green">Grid node detected</div>
              <div className="line green">SHIFTBOT online</div>
              <div className="line red">Grid access denied</div>
              <div className="line accent">
                Awaiting reveal window...<span className="cursor" />
              </div>
            </div>

            <div className="divider" />

            <div className="reveal-wrap">
              <div className="reveal-label">&gt;&gt; REVEAL WINDOW</div>
              <p className="reveal">
                <span className="white">FULL LAUNCH REVEAL</span>
                <span className="sep">//</span>
                <span className="orange">MAY 2026</span>
              </p>
              <div className="ctas">
                <Link className="btn btn-primary" href="/">
                  BACK TO HOME
                </Link>
                <a className="btn btn-ghost" href="#">
                  ACCESS TERMINAL
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="botbar">
          <span>
            <a href="#">lastshift.ai</a>, a company of vibe coders
          </span>
          <span>COLD BOOT</span>
        </div>
      </div>
    </>
  );
}

const gridStyles = `
  html,body{min-height:100dvh;display:flex;flex-direction:column}
  .scanlines{position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.05) 2px,rgba(0,0,0,.05) 4px);pointer-events:none;z-index:9999}
  @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes lineIn{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}
  .sysbar{position:relative;z-index:10;display:flex;justify-content:space-between;align-items:center;padding:8px 18px;font-family:var(--mono);font-size:9px;color:var(--text-dim);letter-spacing:1.5px}
  .sysbar .sb-left,.sysbar .sb-right{display:flex;gap:18px}
  .sysbar .orange{color:var(--accent)}
  .terminal-frame{flex:1;display:flex;flex-direction:column;margin:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-secondary);position:relative;z-index:10;min-height:calc(100dvh - 40px)}
  .titlebar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(0,0,0,.25);border-bottom:1px solid var(--border)}
  .titlebar .tb-left{display:flex;align-items:center;gap:8px}
  .dots{display:flex;gap:6px}
  .dots span{width:10px;height:10px;border-radius:50%}
  .dots .r{background:#ff5f56}.dots .y{background:#ffbd2e}.dots .g{background:#27c93f}
  .title{font-family:var(--mono);font-size:11px;color:var(--text-dim);letter-spacing:1px;margin-left:8px}
  .title-right{font-family:var(--mono);font-size:9px;color:var(--text-dim);letter-spacing:1px}
  .tbody{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px 24px;overflow-y:auto;position:relative}
  .inner{width:100%;max-width:540px;text-align:center}
  .logo{width:56px;height:56px;margin:0 auto 28px;filter:drop-shadow(0 0 12px rgba(255,145,0,.2))}
  .lines{text-align:left;margin:0 auto 26px;max-width:440px}
  .line{font-family:var(--mono);font-size:12px;line-height:2;color:var(--text-dim);padding-left:18px;position:relative;opacity:0;animation:lineIn .35s ease forwards}
  .line::before{content:">";position:absolute;left:0;opacity:.3}
  .line.green{color:var(--green)}.line.green::before{color:var(--green);opacity:.55}
  .line.accent{color:var(--accent)}.line.accent::before{color:var(--accent);opacity:.55}
  .line.red{color:var(--red)}.line.red::before{color:var(--red);opacity:.55}
  .line .cursor{display:inline-block;width:7px;height:12px;background:var(--accent);margin-left:4px;vertical-align:middle;animation:blink 1s step-end infinite}
  .line:nth-child(1){animation-delay:.2s}
  .line:nth-child(2){animation-delay:.7s}
  .line:nth-child(3){animation-delay:1.2s}
  .line:nth-child(4){animation-delay:1.7s}
  .line:nth-child(5){animation-delay:2.2s}
  .line:nth-child(6){animation-delay:2.7s}
  .divider{width:100%;max-width:440px;height:1px;background:linear-gradient(90deg,transparent,var(--border),transparent);margin:0 auto 24px;opacity:0;animation:fadeUp .5s ease forwards;animation-delay:3.2s}
  .reveal-wrap{opacity:0;animation:fadeUp .5s ease forwards;animation-delay:3.5s}
  .reveal-label{font-family:var(--mono);font-size:10px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
  .reveal{font-family:var(--mono);font-size:15px;letter-spacing:2px;margin:0 0 22px;color:var(--text-primary)}
  .reveal .white{color:#fff}
  .reveal .orange{color:var(--accent)}
  .reveal .sep{color:var(--text-dim);margin:0 10px}
  .ctas{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:13px 28px;border-radius:4px;font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .25s;border:1px solid transparent;white-space:nowrap;text-decoration:none}
  .btn-primary{color:var(--accent);border-color:rgba(255,145,0,.25);background:rgba(255,145,0,.04)}
  .btn-primary:hover{border-color:var(--accent);background:rgba(255,145,0,.08);box-shadow:0 0 20px rgba(255,145,0,.08)}
  .btn-ghost{color:var(--text-dim);border-color:var(--border);background:transparent}
  .btn-ghost:hover{color:var(--green);border-color:rgba(0,230,118,.45);background:rgba(0,230,118,.04);box-shadow:0 0 20px rgba(0,230,118,.08)}
  .botbar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-top:1px solid var(--border);background:rgba(0,0,0,.15);font-family:var(--mono);font-size:9px;color:var(--text-dim);letter-spacing:1px}
  .botbar a{color:#2a2d42}
  .botbar a:hover{color:var(--text-secondary)}
  @media (max-width:640px){
    .tbody{padding:22px 16px}
    .reveal{font-size:12px}
    .ctas{flex-direction:column;align-items:center}
    .btn{width:100%;max-width:260px;justify-content:center}
  }
`;
