// მიჯაჭვულობის ენა · Attachment Style — quiz flow, scoring, generated analysis, charts, sharing.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ST = AS.STYLES, ORDER = AS.ORDER, Q = AS.QUESTIONS, N = Q.length;
  const SAVE_KEY = "as_progress_v1", HIST_KEY = "as_history_v1";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  // ---------- seeded randomness ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const shuffle = (r, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- state ----------
  let answers = new Array(N).fill(null); // {m: 'S'|'A'|'V'|'F', s: key|null}
  let idx = 0;
  let optionOrder = []; // shuffled option order per question
  let analysisSeed = Date.now();
  let lastResult = null;

  // ---------- save code: 27 chars, each = main*5 + secondary(4 = none) ----------
  const ALPH = "abcdefghijklmnopqrst";
  function encode(ans) { return ans.map((a) => ALPH[ORDER.indexOf(a.m) * 5 + (a.s ? ORDER.indexOf(a.s) : 4)]).join(""); }
  function decode(code) {
    code = (code || "").trim().toLowerCase();
    if (code.length !== N || [...code].some((c) => !ALPH.includes(c))) return null;
    return [...code].map((c) => {
      const v = ALPH.indexOf(c), m = Math.floor(v / 5), s = v % 5;
      return { m: ORDER[m], s: s === 4 || s === m ? null : ORDER[s] };
    });
  }

  // ---------- scoring ----------
  function score(ans) {
    const tot = { S: 0, A: 0, V: 0, F: 0 };
    const cat = {};
    AS.CATEGORIES.forEach((c) => (cat[c.id] = { S: 0, A: 0, V: 0, F: 0 }));
    ans.forEach((a, i) => {
      const c = Q[i].c;
      tot[a.m] += 1; cat[c][a.m] += 1;
      if (a.s) { tot[a.s] += 0.5; cat[c][a.s] += 0.5; }
    });
    const sum = ORDER.reduce((x, k) => x + tot[k], 0);
    const pct = {}; ORDER.forEach((k) => (pct[k] = tot[k] / sum));
    const sorted = ORDER.slice().sort((a, b) => pct[b] - pct[a]);
    const catPct = {};
    AS.CATEGORIES.forEach((c) => { const s = ORDER.reduce((x, k) => x + cat[c.id][k], 0); catPct[c.id] = {}; ORDER.forEach((k) => (catPct[c.id][k] = cat[c.id][k] / s)); });
    const anx = pct.A + pct.F, avd = pct.V + pct.F;
    const top = pct[sorted[0]], second = pct[sorted[1]];
    const type = top >= 0.6 ? "clear" : top - second < 0.1 ? "blended" : "dominant";
    // rounded percentages that sum to 100
    const raw = ORDER.map((k) => pct[k] * 100), floor = raw.map(Math.floor);
    let rest = 100 - floor.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - floor[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { floor[i]++; rest--; } });
    const pct100 = {}; ORDER.forEach((k, i) => (pct100[k] = floor[i]));
    return { pct, pct100, sorted, primary: sorted[0], secondary: sorted[1], catPct, anx, avd, type };
  }
  const level = (v) => (v < 0.33 ? "low" : v < 0.6 ? "mid" : "high");
  const styleTag = (k) => `<b class="st" style="color:${ST[k].color}">${ST[k].name}</b>`;

  // ---------- generated analysis ----------
  function analysis(res, seed) {
    const r = rng(seed);
    const P = res.primary, S = res.secondary, pro = AS.PROFILE[P];
    const out = [];
    out.push(pick(r, AS.OPEN[res.type]).replace("{P}", styleTag(P)).replace("{S}", styleTag(S)));
    out.push(`${pick(r, pro.essence)} შენი შინაგანი მოდელი დაახლოებით ასე ჟღერს: <i>${pro.belief}</i> ${pro.strategy}`);
    if (res.pct[S] >= 0.15 && AS.COMBO[P + S]) out.push(AS.COMBO[P + S]);
    const dimOrder = r() < 0.5 ? ["anx", "avd"] : ["avd", "anx"];
    out.push(dimOrder.map((d) => pick(r, AS.DIM[d][level(d === "anx" ? res.anx : res.avd)])).join(" "));
    // category highlights: strongest and most vulnerable (random tie-breaks)
    const cats = shuffle(r, AS.CATEGORIES).sort((a, b) => res.catPct[b.id].S - res.catPct[a.id].S);
    const strong = cats[0], weak = cats[cats.length - 1];
    const dom = (c) => ORDER.slice().sort((a, b) => res.catPct[c.id][b] - res.catPct[c.id][a])[0];
    const weakInsecure = ORDER.filter((k) => k !== "S").sort((a, b) => res.catPct[weak.id][b] - res.catPct[weak.id][a])[0];
    if (res.catPct[strong.id].S > res.catPct[weak.id].S) {
      out.push(`${pick(r, ["ყველაზე მყარად თავს გრძნობ სფეროში", "შენი ყველაზე ძლიერი სფეროა", "ყველაზე მეტი სიმშვიდე ჩანს სფეროში"])} <b>„${strong.name}“</b>: ${AS.CAT_TEXT[strong.id][dom(strong)]} ${pick(r, ["ყველაზე მეტი ზრდის სივრცე კი აქ არის:", "ყველაზე მგრძნობიარე წერტილი კი ეს სფეროა:", "სამაგიეროდ, ყურადღება ამ სფეროს სჭირდება:"])} <b>„${weak.name}“</b> — ${AS.CAT_TEXT[weak.id][weakInsecure]}`);
    } else {
      out.push(`შენი პასუხები ყველა სფეროში საკმაოდ ერთგვაროვანია — ${AS.CAT_TEXT[strong.id][dom(strong)]}`);
    }
    const lensKeys = Object.keys(AS.LENS);
    const lens = AS.LENS[lensKeys[Math.floor(r() * lensKeys.length)]];
    out.push(`<span class="lens">${lens.title}</span> ${lens[P]}${res.pct[S] >= 0.2 && S !== P ? ` ხოლო როცა ${styleTag(S)} რეჟიმი ირთვება: ${lens[S].charAt(0).toLowerCase() + lens[S].slice(1)}` : ""}`);
    out.push(pick(r, AS.CLOSE));
    return out;
  }

  // ---------- 7-day plan (weighted by insecure shares; secure habits if mostly secure) ----------
  function plan(res, seed) {
    const r = rng(seed ^ 0x9e3779b9);
    const insecure = ORDER.filter((k) => k !== "S" && res.pct[k] >= 0.12).sort((a, b) => res.pct[b] - res.pct[a]);
    const pools = insecure.length ? insecure : ["S"];
    const days = [];
    const used = new Set();
    for (let d = 0; d < 7; d++) {
      let k = pools[0];
      if (pools.length > 1) { const total = pools.reduce((x, p) => x + res.pct[p], 0); let t = r() * total; for (const p of pools) { t -= res.pct[p]; if (t <= 0) { k = p; break; } } }
      const cand = AS.PRACTICE[k].filter((x) => !used.has(x));
      const item = cand.length ? pick(r, cand) : pick(r, AS.PRACTICE.S);
      used.add(item); days.push({ k, item });
    }
    return days;
  }

  // ---------- charts ----------
  function donut(res) {
    const R = 80, C = 2 * Math.PI * R; let off = 0;
    const segs = ORDER.map((k) => { const len = res.pct[k] * C; const s = `<circle r="${R}" cx="110" cy="110" fill="none" stroke="${ST[k].color}" stroke-width="34" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 110 110)"/>`; off += len; return s; }).join("");
    return `<svg viewBox="0 0 220 220" class="donut">${segs}<text x="110" y="104" text-anchor="middle" class="d-big" fill="${ST[res.primary].color}">${res.pct100[res.primary]}%</text><text x="110" y="132" text-anchor="middle" class="d-small">${ST[res.primary].name}</text></svg>`;
  }
  function bars(res) {
    return ORDER.slice().sort((a, b) => res.pct[b] - res.pct[a]).map((k) => `
      <div class="bar-row"><div class="bar-label"><span class="dot" style="background:${ST[k].color}"></span>${ST[k].name}</div>
      <div class="bar-track"><div class="bar-fill" style="--w:${res.pct100[k]}%;background:${ST[k].color}"></div></div><div class="bar-val">${res.pct100[k]}%</div></div>`).join("");
  }
  function map2d(res) {
    const x = 30 + res.avd * 260, y = 290 - res.anx * 260;
    return `<svg viewBox="0 0 320 330" class="map">
      <rect x="30" y="30" width="130" height="130" fill="${ST.A.soft}"/><rect x="160" y="30" width="130" height="130" fill="${ST.F.soft}"/>
      <rect x="30" y="160" width="130" height="130" fill="${ST.S.soft}"/><rect x="160" y="160" width="130" height="130" fill="${ST.V.soft}"/>
      <text x="95" y="52" class="q" fill="${ST.A.color}">შფოთვიანი</text><text x="225" y="52" class="q" fill="${ST.F.color}">შიშნარევი</text>
      <text x="95" y="280" class="q" fill="${ST.S.color}">უსაფრთხო</text><text x="225" y="280" class="q" fill="${ST.V.color}">ამრიდებელი</text>
      <line x1="30" y1="290" x2="296" y2="290" class="ax"/><line x1="30" y1="290" x2="30" y2="24" class="ax"/>
      <text x="160" y="318" class="axl">არიდება →</text><text x="12" y="160" class="axl" transform="rotate(-90 12 160)">შფოთვა →</text>
      <circle cx="${x}" cy="${y}" r="18" class="pulse" fill="${ST[res.primary].color}"/><circle cx="${x}" cy="${y}" r="9" fill="#111" stroke="#fff" stroke-width="3"/>
    </svg>`;
  }
  function catRows(res) {
    const secure = AS.CATEGORIES.map((c) => res.catPct[c.id].S);
    const maxS = Math.max(...secure), minS = Math.min(...secure);
    return AS.CATEGORIES.map((c) => {
      const cp = res.catPct[c.id];
      const dom = ORDER.slice().sort((a, b) => cp[b] - cp[a])[0];
      const tag = maxS !== minS && cp.S === maxS ? `<span class="tag good">ძლიერი მხარე</span>` : maxS !== minS && cp.S === minS ? `<span class="tag grow">ზრდის ზონა</span>` : "";
      const seg = ORDER.filter((k) => cp[k] > 0).map((k) => `<span style="width:${cp[k] * 100}%;background:${ST[k].color}" title="${ST[k].name} ${Math.round(cp[k] * 100)}%"></span>`).join("");
      return `<details class="cat"><summary><div class="cat-head"><span>${c.name}</span>${tag}</div><div class="stack">${seg}</div></summary>
        <p>${AS.CAT_TEXT[c.id][dom]}</p><p class="tip">💡 ${cp.S >= 0.5 ? AS.CAT_TIPS[c.id].keep : AS.CAT_TIPS[c.id].build}</p></details>`;
    }).join("");
  }

  // ---------- rendering the result ----------
  function renderResult(ans, fromHistory) {
    const res = score(ans); lastResult = { res, ans };
    const P = res.primary, pro = AS.PROFILE[P], code = encode(ans);
    const typeName = { clear: "მკაფიო პროფილი", dominant: "წამყვანი + დამხმარე სტილი", blended: "შერეული პროფილი" }[res.type];
    const hist = store.get(HIST_KEY, []);
    if (!fromHistory && (!hist.length || hist[hist.length - 1].code !== code)) { hist.push({ code, date: new Date().toISOString(), pct: res.pct100 }); store.set(HIST_KEY, hist.slice(-12)); }
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;
    const weakest = AS.CATEGORIES.slice().sort((a, b) => res.catPct[a.id].S - res.catPct[b.id].S).slice(0, 3);
    const needHelp = res.pct.F >= 0.25 || res.catPct.origin.F >= 0.5;
    const pl = plan(res, analysisSeed);

    $("#result").innerHTML = `
      <section class="card hero-res" style="--c:${ST[P].color};--soft:${ST[P].soft}">
        <div class="eyebrow">შენი მთავარი მიჯაჭვულობის სტილი</div>
        <h1 style="color:${ST[P].color}">${ST[P].name}</h1>
        <p class="lead">${pro.essence[0]}</p>
        <div class="chips"><span class="chip">${typeName}</span><span class="chip">მეორადი: ${ST[res.secondary].name} ${res.pct100[res.secondary]}%</span></div>
      </section>

      <section class="card">
        <h2>შენი სტილების ნარევი</h2>
        <p class="muted">ადამიანების უმეტესობას ერთი კი არა, რამდენიმე სტილის კომბინაცია აქვს. აი, რა პროპორციით გაქვს განვითარებული თითოეული:</p>
        <div class="mix">${donut(res)}<div class="bars">${bars(res)}</div></div>
        ${prev ? `<p class="muted small">წინა შედეგთან (${new Date(prev.date).toLocaleDateString("ka-GE")}) შედარებით: ${ORDER.map((k) => { const d = res.pct100[k] - (prev.pct[k] || 0); return `${ST[k].name} ${d > 0 ? "▲" + d : d < 0 ? "▼" + -d : "="}`; }).join(" · ")}</p>` : ""}
      </section>

      <section class="card">
        <h2>შენი წერტილი მიჯაჭვულობის რუკაზე</h2>
        <p class="muted">თანამედროვე კვლევები მიჯაჭვულობას ორი განზომილებით ზომავს: <b>შფოთვა</b> (მიტოვების შიში) და <b>არიდება</b> (სიახლოვის დისკომფორტი).</p>
        <div class="mapwrap">${map2d(res)}
          <div class="dims"><div class="dim"><div class="dim-top"><span>შფოთვა</span><b>${Math.round(res.anx * 100)}%</b></div><div class="bar-track"><div class="bar-fill" style="--w:${Math.round(res.anx * 100)}%;background:${ST.A.color}"></div></div></div>
          <div class="dim"><div class="dim-top"><span>არიდება</span><b>${Math.round(res.avd * 100)}%</b></div><div class="bar-track"><div class="bar-fill" style="--w:${Math.round(res.avd * 100)}%;background:${ST.V.color}"></div></div></div>
          <p class="muted small">რაც უფრო ახლოსაა წერტილი ქვედა მარცხენა კუთხესთან, მით უფრო უსაფრთხოა მიჯაჭვულობა.</p></div>
        </div>
      </section>

      <section class="card analysis">
        <div class="row-between"><h2>პერსონალური ანალიზი</h2><button class="btn ghost" id="regen">↻ სხვა კუთხით</button></div>
        <div id="analysisText"></div>
      </section>

      <section class="card grid2">
        <div><h3>💪 შენი ძლიერი მხარეები</h3><ul>${pro.strengths.map((s) => `<li>${s}</li>`).join("")}${res.pct[res.secondary] >= 0.2 ? `<li class="muted">${ST[res.secondary].name} ნაწილიდან: ${AS.PROFILE[res.secondary].strengths[0].toLowerCase()}</li>` : ""}</ul></div>
        <div><h3>🌱 ზრდის ზონები</h3><ul>${pro.challenges.map((s) => `<li>${s}</li>`).join("")}</ul></div>
        <div><h3>⚡ რა გრთავს ტრიგერს</h3><p>${pro.triggers}</p></div>
        <div><h3>🤍 რა გჭირდება ურთიერთობაში</h3><p>${pro.needs}</p></div>
      </section>

      <section class="card">
        <h2>9 სფერო — სად როგორ ხარ</h2>
        <p class="muted">თითოეულ ზოლზე ჩანს, რომელი სტილი რა წილით ვლინდება ამ სფეროში. დააჭირე ახსნისთვის.</p>
        <div class="legend">${ORDER.map((k) => `<span><i style="background:${ST[k].color}"></i>${ST[k].name}</span>`).join("")}</div>
        ${catRows(res)}
      </section>

      <section class="card">
        <h2>გამოსწორების გზა</h2>
        <p class="muted">კვლევები აჩვენებს, რომ მიჯაჭვულობის სტილი იცვლება — „შეძენილი უსაფრთხოება“ რეალური და მიღწევადია. დაიწყე იქიდან, სადაც ყველაზე მეტი ზრდის სივრცეა:</p>
        <div class="focus">${weakest.map((c) => `<div class="fcard"><b>${c.short}</b><p>${AS.CAT_TIPS[c.id].build}</p></div>`).join("")}</div>
        <h3>7-დღიანი გეგმა შენთვის</h3>
        <ol class="plan">${pl.map((d, i) => `<li><span class="day">დღე ${i + 1}</span><span class="pdot" style="background:${ST[d.k].color}"></span>${d.item}</li>`).join("")}</ol>
        ${needHelp ? `<div class="notice"><b>როდის ღირს სპეციალისტთან მისვლა?</b> შენს პასუხებში შიშნარევი ხაზი ან მტკივნეული ადრეული გამოცდილება ჩანს. ასეთ დროს ყველაზე ეფექტურია ტრავმაზე ორიენტირებული თერაპია (მაგ. EFT, სქემა-თერაპია, EMDR). დახმარების თხოვნა სისუსტე არ არის — ეს უსაფრთხოების პირველი ნაბიჯია.</div>` : `<div class="notice soft">თუ ურთიერთობები ხშირად მტკივნეულად მთავრდება ან ერთსა და იმავე სცენარს იმეორებ, ფსიქოთერაპევტთან რამდენიმე შეხვედრაც კი დიდ განსხვავებას ქმნის.</div>`}
      </section>

      <section class="card">
        <h2>როგორ ხვდები სხვადასხვა სტილის პარტნიორს</h2>
        <div class="pairs">${ORDER.map((k) => `<div class="pair" style="border-color:${ST[k].color}"><div class="pair-h"><span class="dot" style="background:${ST[P].color}"></span>${ST[P].name} + <span class="dot" style="background:${ST[k].color}"></span>${ST[k].name}</div><p>${AS.PAIRS[P][k]}</p></div>`).join("")}</div>
      </section>

      <section class="card share">
        <h2>შეინახე და გააზიარე</h2>
        <div class="code-row"><div><div class="muted small">შენი შედეგის კოდი</div><code id="code">${code}</code></div><button class="btn ghost" id="copyCode">დააკოპირე</button></div>
        <div class="btns"><button class="btn" id="storyBtn">📱 სთორის სურათი</button><button class="btn ghost" id="linkBtn">🔗 ბმული შედეგზე</button><button class="btn ghost" id="printBtn">🖨 PDF / ბეჭდვა</button><button class="btn ghost" id="retake">↺ თავიდან</button></div>
        <p class="muted small">გადაამოწმე შედეგი 2–3 თვეში — ისტორია ამ მოწყობილობაზე ინახება და ცვლილებას დაგანახებს.</p>
      </section>

      <section class="card science">
        <h2>მეცნიერული საფუძველი</h2>
        ${AS.SCIENCE.map((s) => `<p><b>${s.t}.</b> ${s.d}</p>`).join("")}
        <p class="muted small">ეს ტესტი თვითშემეცნების ინსტრუმენტია და არა კლინიკური დიაგნოზი ან სტანდარტიზებული კითხვარი (ECR-R). ტესტის შედეგი არ ცვლის ფსიქოლოგის ან ფსიქოთერაპევტის კონსულტაციას.</p>
      </section>`;

    const drawAnalysis = () => {
      const paras = analysis(res, analysisSeed);
      $("#analysisText").innerHTML = paras.map((p) => `<p>${p}</p>`).join("");
      $("#analysisText").classList.remove("fade"); void $("#analysisText").offsetWidth; $("#analysisText").classList.add("fade");
    };
    drawAnalysis();
    $("#regen").onclick = () => { analysisSeed = (analysisSeed * 1103515245 + 12345) >>> 0; drawAnalysis(); };
    $("#copyCode").onclick = () => copy(code, $("#copyCode"));
    $("#linkBtn").onclick = () => copy(`${location.origin}${location.pathname}#r=${code}`, $("#linkBtn"));
    $("#printBtn").onclick = () => { $$("details.cat").forEach((d) => (d.open = true)); window.print(); };
    $("#retake").onclick = () => { store.del(SAVE_KEY); answers = new Array(N).fill(null); idx = 0; history.replaceState(null, "", location.pathname); show("landing"); };
    $("#storyBtn").onclick = () => storyImage(res);
    show("result");
    requestAnimationFrame(() => $$(".bar-fill").forEach((b) => b.classList.add("go")));
  }

  function copy(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = "✓ დაკოპირდა"; setTimeout(() => (btn.textContent = t), 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt("დააკოპირე:", text));
    else prompt("დააკოპირე:", text);
  }

  // ---------- story image (1080x1920) ----------
  async function storyImage(res) {
    try { await Promise.all(["800 90px FiraGO", "600 40px FiraGO", "500 30px Montserrat"].map((f) => document.fonts.load(f))); } catch (e) { /* fall back */ }
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920; const g = cv.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 1080, 1920); grd.addColorStop(0, "#14122B"); grd.addColorStop(1, "#2A1B4E"); g.fillStyle = grd; g.fillRect(0, 0, 1080, 1920);
    const blob = (x, y, r, c) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, "transparent"); g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920); };
    blob(900, 300, 600, "rgba(79,70,229,0.55)"); blob(150, 1650, 650, "rgba(255,107,94,0.35)");
    const logo = new Image(); logo.src = "assets/logo-icon.svg"; await new Promise((ok) => { logo.onload = ok; logo.onerror = ok; });
    try { g.drawImage(logo, 90, 110, 66, 100); } catch (e) { /* ignore */ }
    g.fillStyle = "#fff"; g.font = "600 34px Montserrat, sans-serif"; g.fillText("Attachment Style", 176, 172);
    g.font = "600 44px FiraGO, sans-serif"; g.fillStyle = "#ffffffcc"; g.fillText("ჩემი მიჯაჭვულობის სტილი:", 90, 420);
    g.font = "800 104px FiraGO, sans-serif"; g.fillStyle = ST[res.primary].color;
    const name = ST[res.primary].name; if (g.measureText(name).width > 900) g.font = "800 72px FiraGO, sans-serif"; g.fillText(name, 90, 550);
    let y = 720;
    ORDER.slice().sort((a, b) => res.pct[b] - res.pct[a]).forEach((k) => {
      g.font = "600 40px FiraGO, sans-serif"; g.fillStyle = "#fff"; g.fillText(ST[k].name, 90, y);
      g.textAlign = "right"; g.fillText(res.pct100[k] + "%", 990, y); g.textAlign = "left";
      g.fillStyle = "rgba(255,255,255,0.15)"; roundRect(g, 90, y + 24, 900, 26, 13); g.fill();
      g.fillStyle = ST[k].color; roundRect(g, 90, y + 24, Math.max(26, 900 * res.pct[k]), 26, 13); g.fill();
      y += 150;
    });
    g.font = "500 40px FiraGO, sans-serif"; g.fillStyle = "#ffffffdd"; wrap(g, "შენ რომელი ხარ? გაიარე ტესტი და გაიგე.", 90, 1420, 900, 56);
    const bg = g.createLinearGradient(90, 0, 990, 0); bg.addColorStop(0, "#4F46E5"); bg.addColorStop(1, "#FF6B5E"); g.fillStyle = bg; roundRect(g, 90, 1560, 900, 130, 65); g.fill();
    g.fillStyle = "#fff"; g.font = "800 50px FiraGO, sans-serif"; g.textAlign = "center"; g.fillText("მიჯაჭვულობის ენა", 540, 1642);
    const a = document.createElement("a"); a.download = "attachment-style.png"; a.href = cv.toDataURL("image/png"); a.click();
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrap(g, text, x, y, max, lh) { let line = ""; for (const w of text.split(" ")) { const t = line ? line + " " + w : w; if (g.measureText(t).width > max) { g.fillText(line, x, y); y += lh; line = w; } else line = t; } g.fillText(line, x, y); }

  // ---------- quiz flow ----------
  function show(id) { $$(".screen").forEach((s) => s.classList.toggle("on", s.id === id)); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function newOrder() { const r = rng(Date.now()); optionOrder = Q.map(() => shuffle(r, ORDER)); }

  function renderQ() {
    const q = Q[idx], a = answers[idx] || { m: null, s: null }, cat = AS.CATEGORIES.find((c) => c.id === q.c);
    $("#qnum").textContent = `${idx + 1} / ${N}`;
    $("#qcat").textContent = cat.name;
    $("#progress").style.width = `${(idx / N) * 100}%`;
    $("#qtext").textContent = q.q;
    $("#options").innerHTML = optionOrder[idx].map((k, i) => {
      const cls = a.m === k ? "opt main" : a.s === k ? "opt sec" : "opt";
      return `<button class="${cls}" data-k="${k}"><span class="key">${i + 1}</span><span class="otext">${q.o[k]}</span>${a.s === k ? `<span class="badge">ნაწილობრივ</span>` : a.m === k ? `<span class="badge main">ყველაზე ახლოს</span>` : ""}</button>`;
    }).join("");
    $("#hint").textContent = a.m ? "თუ კიდევ ერთი პასუხი ნაწილობრივ გეხება, მონიშნე (არასავალდებულო)" : "აირჩიე პასუხი, რომელიც ყველაზე ახლოსაა შენთან";
    $("#next").disabled = !a.m;
    $("#next").textContent = idx === N - 1 ? "შედეგის ნახვა →" : "შემდეგი →";
    $("#back").style.visibility = idx === 0 ? "hidden" : "visible";
    $$("#options .opt").forEach((b) => (b.onclick = () => choose(b.dataset.k)));
  }
  function choose(k) {
    const a = answers[idx] || { m: null, s: null };
    if (!a.m) a.m = k;
    else if (a.m === k) { a.m = a.s; a.s = null; }
    else if (a.s === k) a.s = null;
    else a.s = k;
    answers[idx] = a.m ? a : null;
    store.set(SAVE_KEY, { answers, idx, order: optionOrder });
    renderQ();
  }
  function next() {
    if (!answers[idx]) return;
    if (idx < N - 1) { idx++; store.set(SAVE_KEY, { answers, idx, order: optionOrder }); renderQ(); window.scrollTo({ top: 0 }); }
    else { store.del(SAVE_KEY); analysisSeed = Date.now(); history.replaceState(null, "", `#r=${encode(answers)}`); renderResult(answers, false); }
  }
  function start(resume) {
    const saved = store.get(SAVE_KEY, null);
    if (resume && saved) { answers = saved.answers; idx = saved.idx; optionOrder = saved.order; }
    else { answers = new Array(N).fill(null); idx = 0; newOrder(); }
    renderQ(); show("quiz");
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    $("#startBtn").onclick = () => start(false);
    $("#resumeBtn").onclick = () => start(true);
    $("#next").onclick = next;
    $("#back").onclick = () => { if (idx > 0) { idx--; renderQ(); } };
    $("#home").onclick = (e) => { e.preventDefault(); show("landing"); };
    $("#loadBtn").onclick = () => {
      const ans = decode($("#loadCode").value);
      if (!ans) { $("#loadErr").textContent = "კოდი არასწორია — უნდა იყოს 27 სიმბოლო."; return; }
      $("#loadErr").textContent = ""; analysisSeed = Date.now(); renderResult(ans, true);
    };
    document.addEventListener("keydown", (e) => {
      if (!$("#quiz").classList.contains("on")) return;
      if (["1", "2", "3", "4"].includes(e.key)) choose(optionOrder[idx][+e.key - 1]);
      if (e.key === "Enter" || e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft" && idx > 0) { idx--; renderQ(); }
    });
    $("#qcount").textContent = N;
    if (store.get(SAVE_KEY, null)) $("#resumeBtn").hidden = false;
    const m = location.hash.match(/r=([a-t]{27})/);
    if (m) { const ans = decode(m[1]); if (ans) renderResult(ans, true); }
  });
})();
