#!/usr/bin/env python3
"""Builds regelwerk.html, philosophie.html and impressum.html with the shared GRANDE layout.
The Regelwerk text is taken verbatim from the current live page (source/regelwerk_original.html)."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
DISCORD_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.4C.6 9 0 13.5.3 18a19.7 19.7 0 0 0 6 3l1.3-2a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 11.8 0l.5.4a12.8 12.8 0 0 1-2 1l1.3 2a19.6 19.6 0 0 0 6-3c.4-5.2-.7-9.6-3.4-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z"/></svg>'
DESC = "GRANDE Roleplay: ernsthaftes FiveM-Roleplay mit eigenen Scripts, Cayo Porto, Grenze und Zoll, Werkstätten und vielen legalen Jobs."

def page(slug, title, desc, body):
    nav = [('index.html', 'Startseite'), ('index.html#stadt', 'Die Stadt'), ('index.html#fraktionen', 'Fraktionen'), ('index.html#status', 'Status'), ('regelwerk.html', 'Regelwerk'), ('philosophie.html', 'Philosophie')]
    links = ''.join(f'<li><a href="{h}"{" aria-current=\"page\"" if h == slug + ".html" else ""}>{t}</a></li>' for h, t in nav)
    mlinks = ''.join(f'<a class="m-link" href="{h}">{t}</a>' for h, t in nav + [('impressum.html', 'Impressum')])
    return f'''<!doctype html>
<html lang="de-CH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#09090b">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://granderoleplay.ch/assets/img/logo-og.png">
<meta property="og:url" content="https://granderoleplay.ch/{slug}">
<link rel="icon" type="image/png" sizes="32x32" href="assets/img/icon-32.png">
<link rel="apple-touch-icon" href="assets/img/icon-192.png">
<link rel="preload" href="assets/fonts/Cinzel.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/fonts/fonts.css">
<link rel="stylesheet" href="assets/css/site.css">
</head>
<body>
<header class="nav solid">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="GRANDE Roleplay – Startseite"><img src="assets/img/logo-grande-240.webp" alt="GRANDE Roleplay" width="240" height="81"></a>
    <ul class="nav-links">{links}</ul>
    <div class="nav-cta">
      <a class="btn btn-gold btn-sm" href="https://discord.gg/granderoleplay" target="_blank" rel="noopener" aria-label="Discord">{DISCORD_SVG}<span class="btn-label">Discord</span></a>
      <button class="menu-btn" type="button" data-menu aria-expanded="false" aria-label="Menü öffnen"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<nav class="mobile-menu" aria-label="Hauptmenü">
  <button class="menu-btn close" type="button" data-menu aria-label="Menü schliessen" style="display:block"><span style="transform:translateY(5.5px) rotate(45deg)"></span><span style="opacity:0"></span><span style="transform:translateY(-5.5px) rotate(-45deg)"></span></button>
  {mlinks}
  <div class="m-cta"><a class="btn btn-gold" href="fivem://connect/cfx.re/join/qqqepoz">Jetzt spielen</a><a class="btn btn-ghost" href="https://discord.gg/granderoleplay" target="_blank" rel="noopener">Discord</a></div>
</nav>
{body}
<footer class="footer">
  <div class="wrap">
    <div class="f-brand"><img src="assets/img/logo-grande-240.webp" alt="" width="240" height="81" loading="lazy"><span>© 2026 GRANDE Roleplay · Fan-Projekt, nicht verbunden mit Rockstar Games oder Take-Two.</span></div>
    <nav aria-label="Footer"><a href="regelwerk.html">Regelwerk</a><a href="philosophie.html">Philosophie</a><a href="https://discord.gg/granderoleplay" target="_blank" rel="noopener">Discord</a><a href="impressum.html">Impressum &amp; Datenschutz</a></nav>
  </div>
</footer>
<div class="action-bar"><a class="btn btn-gold" href="fivem://connect/cfx.re/join/qqqepoz">Jetzt spielen</a><a class="btn btn-ghost" href="https://discord.gg/granderoleplay" target="_blank" rel="noopener">Discord</a></div>
<script src="assets/js/site.js" defer></script>
</body>
</html>
'''

# ---------------- Regelwerk (verbatim rules) ----------------
src = (ROOT / 'source' / 'regelwerk_original.html').read_text(encoding='utf-8')
tabs = re.search(r'<div class="r-tabs"[^>]*>.*?</div>', src, re.S).group(0)
tabs = tabs.replace('class="r-tab on"', 'class="r-tab on" role="tab" aria-selected="true"').replace('class="r-tab"', 'class="r-tab" role="tab" aria-selected="false"')
i0 = src.index('<div class="rules">'); i1 = src.index('<p class="rules-stand">')
rules = src[i0:i1].rstrip()
rules = re.sub(r'(<table.*?</table>)', r'<div class="r-table-wrap">\1</div>', rules, flags=re.S)
stand = re.search(r'<p class="rules-stand">(.*?)</p>', src, re.S).group(1)
rw_body = f'''<div class="rw-progress" aria-hidden="true"></div>
<main>
  <section class="page-hero">
    <div class="page-hero-bg" style="background-image:url(assets/img/shot1-900.webp)" aria-hidden="true"></div>
    <div class="wrap">
      <span class="eyebrow">GRANDE Roleplay</span>
      <h1 class="h-display"><span class="foil">Regelwerk</span></h1>
      <p class="lead">Nimm dir genug Zeit, um das Regelwerk zu lesen!</p>
    </div>
  </section>
  <section class="wrap" style="padding-bottom:100px">
    <div class="rw-layout">
      <nav class="rw-toc" aria-label="Inhaltsverzeichnis"></nav>
      <div>
        <div class="rw-tools">
          {tabs}
          <div class="r-row">
            <label class="r-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="rw-search" type="search" placeholder="Regelwerk durchsuchen … (Enter = nächster Treffer)" aria-label="Regelwerk durchsuchen"><span class="r-count" aria-live="polite"></span></label>
            <button class="r-btn" type="button" data-expand>Alle öffnen</button>
          </div>
        </div>
        {rules}
        <p class="rw-note">{stand}</p>
      </div>
    </div>
  </section>
</main>'''
(ROOT / 'regelwerk.html').write_text(page('regelwerk', 'Regelwerk – GRANDE Roleplay', DESC, rw_body), encoding='utf-8')

# ---------------- Philosophie (original text) ----------------
ph_body = '''<main>
  <section class="page-hero">
    <div class="page-hero-bg" style="background-image:url(assets/img/shot1.webp)" aria-hidden="true"></div>
    <div class="wrap">
      <span class="eyebrow">GRANDE Roleplay</span>
      <h1 class="h-display">Unsere <span class="foil">Philosophie</span></h1>
      <p class="lead">Wofür wir stehen und was du von uns erwarten kannst</p>
    </div>
  </section>
  <section class="band" style="padding-top:40px">
    <div class="wrap split">
      <div class="reveal">
        <span class="eyebrow">Deine Stadt</span>
        <h2 class="h-display h2" style="margin:16px 0 22px">Deine Stadt für <span class="foil">echtes</span> Roleplay</h2>
        <p class="lead">In GRANDE steht dein Charakter im Mittelpunkt. Jede Begegnung kann der Anfang einer Geschichte sein: ein Deal im Hinterhof, eine Kontrolle an der Grenze, ein Feierabend am Hafen von Cayo Porto.</p>
        <p class="lead">Wir wollen eine Stadt, die sich echt anfühlt. Dafür braucht es Spieler, die ihre Rolle ernst nehmen, fair miteinander umgehen und anderen Raum für ihre Geschichte lassen.</p>
      </div>
      <figure class="reveal" style="margin:0">
        <img src="assets/img/shot1.webp" alt="Szene aus GRANDE Roleplay" width="1672" height="941" loading="lazy">
        <figcaption style="margin-top:12px;color:var(--muted)"><b style="color:var(--gold-hi);font-family:var(--f-label);letter-spacing:.14em;text-transform:uppercase">Gemeinsam Geschichten schreiben</b> · Jeder Charakter macht die Stadt lebendiger</figcaption>
      </figure>
    </div>
    <div class="wrap"><ul class="pillars"><li class="chip">Kein OOC</li><li class="chip">Respekt</li><li class="chip">Immersion</li><li class="chip">Storylines</li><li class="chip">Gemeinschaft</li></ul></div>
  </section>
  <section class="quote-band" aria-label="Zitat">
    <img class="bg" src="assets/img/shot1.webp" alt="" loading="lazy" decoding="async" width="1672" height="941">
    <div class="wrap"><blockquote class="reveal"><p>Bei uns zählt nicht, wer am lautesten ist oder am meisten besitzt, sondern wer die besten Geschichten erzählt.</p><cite>— GRANDE Team</cite></blockquote></div>
  </section>
  <section class="band">
    <div class="wrap">
      <div class="notice reveal">
        <h3>Wichtig zu wissen</h3>
        <p>GRANDE ist kein Server zum schnellen Ballern oder Farmen. Wer keine Lust hat, sich in einen Charakter hineinzuversetzen, wird hier wenig Spass haben.</p>
        <p>Ob du als Polizist, Mechaniker, Fischer oder auf der kriminellen Seite unterwegs bist: Wir erwarten durchdachte Entscheidungen, echte Gespräche und Situationen, die realistisch ausgespielt werden.</p>
        <p style="margin-bottom:0">Gespräche über das echte Leben, den Server oder das Regelwerk haben im Spiel nichts verloren. So bleibt die Welt für alle glaubwürdig.</p>
      </div>
    </div>
  </section>
  <section class="band band-alt">
    <div class="wrap">
      <header class="sec-head reveal"><span class="eyebrow">Das Fundament</span><h2 class="h-display h2">Unsere <span class="foil">Kernwerte</span></h2></header>
      <div class="values">
        <article class="value reveal"><span class="num">01</span><h3>Glaubwürdige Charaktere</h3><p>Jeder Charakter hat eine Geschichte, Stärken und Schwächen. Wie er handelt, muss zu ihm passen, auch wenn es für dich gerade unbequem ist.</p></article>
        <article class="value reveal"><span class="num">02</span><h3>Respekt auf Augenhöhe</h3><p>Hinter jedem Charakter sitzt ein Mensch. Wir gehen fair miteinander um, im Spiel und ausserhalb, egal ob Neuling oder alter Hase.</p></article>
        <article class="value reveal"><span class="num">03</span><h3>Szenen wie im Film</h3><p>Lieber eine lange, spannende Verfolgung als eine kurze Schiesserei. Wir spielen Momente aus, statt sie abzukürzen.</p></article>
        <article class="value reveal"><span class="num">04</span><h3>Miteinander statt Gegeneinander</h3><p>Es geht nicht ums Gewinnen. Auch eine Verhaftung oder ein verlorener Deal kann die beste Geschichte des Abends sein.</p></article>
      </div>
    </div>
  </section>
  <section class="band">
    <div class="wrap finale">
      <span class="eyebrow">Bereit?</span>
      <h2 class="h-display h2">Die Stadt gehört <span class="foil">dir</span></h2>
      <p class="lead">GRANDE ist eine Community im Aufbau. Komm jetzt dazu und schreib von Anfang an mit an der Geschichte dieser Stadt.</p>
      <div class="hero-cta" style="animation:none"><a class="btn btn-gold" href="https://discord.gg/granderoleplay" target="_blank" rel="noopener">Community beitreten</a><a class="btn btn-ghost" href="regelwerk.html">Regelwerk lesen</a></div>
    </div>
  </section>
</main>'''
(ROOT / 'philosophie.html').write_text(page('philosophie', 'Philosophie – GRANDE Roleplay', DESC, ph_body), encoding='utf-8')

# ---------------- Impressum (original text) ----------------
im_body = '''<main>
  <section class="page-hero">
    <div class="wrap">
      <span class="eyebrow">Transparenz &amp; Datenschutz</span>
      <h1 class="h-display" style="font-size:clamp(2.2rem,6vw,4.4rem)">Impressum &amp; <span class="foil">Rechtliches</span></h1>
    </div>
  </section>
  <section class="wrap" style="padding-bottom:110px">
    <div class="notice" style="margin-bottom:48px;text-align:center">
      <h2 class="notice-title">Legal Disclaimer / Haftungsausschluss</h2>
      <p class="disclaimer">"GRANDE ROLEPLAY IS NOT APPROVED, SPONSORED, OR ENDORSED BY ROCKSTAR GAMES."</p>
      <p style="margin-bottom:0">GRANDE Roleplay ist nicht von Rockstar Games genehmigt, gesponsert oder unterstützt.</p>
    </div>
    <div class="legal">
      <nav class="legal-toc" aria-label="Abschnitte"><a href="#impressum">Impressum</a><a href="#haftung">Haftungsausschluss</a><a href="#datenschutz">Datenschutz</a><a href="#cookies">Cookies</a><a href="#rechtliches">Rechtliche Hinweise</a></nav>
      <div class="prose">
        <h2 id="impressum" style="margin-top:0">Impressum</h2>
        <h3>Betreiber</h3><p>GRANDE Roleplay<br>Schweiz (CH)</p>
        <h3>Kontakt</h3><p><a href="https://discord.gg/granderoleplay" target="_blank" rel="noopener">discord.gg/granderoleplay</a><br>Support und Anfragen laufen über Tickets auf unserem Discord.</p>
        <h2 id="haftung">Haftungsausschluss</h2>
        <p>Die Inhalte dieser Website wurden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität übernehmen wir jedoch keine Gewähr. Für Inhalte externer Seiten, auf die wir verlinken, sind ausschliesslich deren Betreiber verantwortlich.</p>
        <h2 id="datenschutz">Datenschutzerklärung</h2>
        <h3>1. Allgemeine Hinweise</h3><p>Der Schutz deiner persönlichen Daten ist uns wichtig. Hier erfährst du, welche Daten wir verarbeiten, wofür und welche Rechte du hast. Wir handeln nach dem Schweizer Datenschutzgesetz (DSG). Du kannst diese Website nutzen, ohne persönliche Angaben zu machen.</p>
        <h3>2. Besuch dieser Website</h3><p>Die Website wird bei Netlify gehostet. Beim Aufruf werden automatisch technische Daten in Server-Logs gespeichert:</p>
        <ul><li>IP-Adresse</li><li>Datum und Uhrzeit des Aufrufs</li><li>aufgerufene Seite</li><li>verwendeter Browser und Betriebssystem</li><li>Referrer-URL</li></ul>
        <p>Diese Daten dienen nur dem sicheren Betrieb der Seite. Wir setzen kein Tracking und keine Analyse-Tools ein.</p>
        <h3>3. Nutzung des FiveM-Servers</h3><p>Wenn du unseren Server betrittst, verarbeiten wir:</p>
        <ul><li>FiveM- bzw. Rockstar-Lizenz-IDs</li><li>Discord-ID (bei Verknüpfung)</li><li>Steam-ID (falls vorhanden)</li><li>Spieldaten wie Charaktere, Inventar und Fahrzeuge</li></ul>
        <p>Diese Daten brauchen wir für den Spielbetrieb, für Fairness und für die Durchsetzung des Regelwerks.</p>
        <h3>4. Discord</h3><p>Für Community und Support nutzen wir Discord. Dort gilt zusätzlich die <a href="https://discord.com/privacy" target="_blank" rel="noopener">Datenschutzerklärung von Discord</a>.</p>
        <h3>5. Server-Status</h3><p>Die Spieleranzeige auf der Startseite fragt die öffentliche FiveM-Serverliste ab. Dabei werden keine persönlichen Daten von dir übertragen.</p>
        <h3>6. Deine Rechte</h3><p>Du kannst jederzeit Auskunft über deine Daten verlangen sowie deren Berichtigung oder Löschung beantragen, soweit keine Pflicht zur Aufbewahrung besteht. Öffne dafür ein Ticket auf unserem Discord.</p>
        <h2 id="cookies">Cookies</h2>
        <h3>Was sind Cookies?</h3><p>Cookies sind kleine Textdateien, die eine Website auf deinem Gerät speichert.</p>
        <h3>Welche Cookies verwenden wir?</h3><p>Keine. Diese Website setzt weder eigene Cookies noch Tracking-Cookies. Externe Seiten wie Discord oder FiveM, die du über unsere Links öffnest, können eigene Cookies verwenden.</p>
        <h3>Cookies verwalten</h3><p>In deinem Browser kannst du jederzeit einstellen, ob und welche Cookies gespeichert werden.</p>
        <h2 id="rechtliches">Rechtliche Hinweise</h2>
        <p>GRANDE Roleplay ist ein privates Community-Projekt und steht in keiner Verbindung zu Take-Two Interactive, Rockstar Games oder anderen Rechteinhabern. Alle verwendeten Marken gehören ihren jeweiligen Eigentümern.</p>
        <p>Grand Theft Auto, Grand Theft Auto V und zugehörige Logos sind eingetragene Marken von Take-Two Interactive Software, Inc. FiveM ist ein Projekt von Cfx.re.</p>
        <p>Unser Server richtet sich ausschliesslich an Personen ab 18 Jahren. Wer den Server betritt, erklärt sich mit unserem <a href="regelwerk.html">Regelwerk</a> einverstanden.</p>
      </div>
    </div>
  </section>
</main>'''
(ROOT / 'impressum.html').write_text(page('impressum', 'Impressum & Datenschutz – GRANDE Roleplay', DESC, im_body), encoding='utf-8')
print('pages built')
