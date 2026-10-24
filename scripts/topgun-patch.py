"""Patch the site's copy of TopGun.java so it runs in the browser under CheerpJ.

Rebuild static/games/topgun/topgun.jar (needs a JDK 8+):
  1. Copy TopGun/*.java from github.com/edng5/classic-minigames into a folder, e.g. tg/
  2. python scripts/topgun-patch.py tg
  3. javac -encoding ISO-8859-1 -source 8 -target 8 -d tg/classes tg/*.java
  4. echo "Main-Class: TopGun" > tg/manifest.txt
  5. jar cfm static/games/topgun/topgun.jar tg/manifest.txt -C tg/classes .
The images in static/games/topgun/ are the repo's assets, with the JPEGs converted to PNG.

- Images load from /app/games/topgun/ (CheerpJ's read-only mount of the web server) when
  running in the browser; from the current folder on a normal PC.
- Save files live in /files/ (CheerpJ's persistent, writable browser storage).
- First run (no save file yet) starts with the game's defaults instead of crashing.
- "missile.png" -> "Missile.png" (web servers are case-sensitive).
- Menus use WASD instead of the arrow keys.
- JPEG assets are shipped as PNG (CheerpJ's JPEG colour management stalls).
- Speed: images converted once to the screen's pixel format, fixed-size draws pre-sized,
  speed rendering hints (skip with --no-perf). Measured: the original stalled to 1-9 fps in
  flight; this holds ~120 fps with game logic at full speed.
- Optional FPS log: run with -Dtg.fps=1 (the site passes it when the page URL has ?fps).
"""
import os, re, sys

src = os.path.join(sys.argv[1], 'TopGun.java')
t = open(src, encoding='latin-1').read()

def sub(a, b, count=1):
    global t
    n = t.count(a)
    assert n == count, (a, n)
    t = t.replace(a, b)

# Paths: helpers declared on the class.
sub('public class TopGun extends JFrame implements ActionListener, KeyListener, Runnable, MouseListener{',
    'public class TopGun extends JFrame implements ActionListener, KeyListener, Runnable, MouseListener{\n'
    '  // Browser (CheerpJ): assets from the web server, saves in persistent browser storage.\n'
    '  static final String ASSETS = new File("/app/games/topgun/" + "TGMM.png").exists() ? "/app/games/topgun/" : "";\n'
    '  static final String SAVES = new File("/files/").isDirectory() ? "/files/" : "";\n')

# Images: new File("X.png") / createImage("X.gif") -> prefixed with ASSETS.
t, n1 = re.subn(r'new File\("([^"]+\.(?:png|jpg|gif))"\)', lambda m: 'new File(ASSETS + "' + m.group(1) + '")', t)
t, n2 = re.subn(r'createImage\("([^"]+\.(?:png|jpg|gif))"\)', lambda m: 'createImage(ASSETS + "' + m.group(1) + '")', t)
print('image paths patched:', n1, n2)
sub('ASSETS + "missile.png"', 'ASSETS + "Missile.png"')

# JPEG -> PNG copies (decoding JPEGs stalls in the browser runtime).
t, n3 = re.subn(r'(ASSETS \+ "[^"]+)\.jpg"', lambda m: m.group(1) + '.png"', t)
print('jpg -> png:', n3)

# Save files.
sub('File f=new File("TopGunFile.txt");', 'File f=new File(SAVES + "TopGunFile.txt");')
sub('File f2=new File("TopGunFile2.txt");', 'File f2=new File(SAVES + "TopGunFile2.txt");')

# First run: no save file -> skip loading (the original assumed the file existed).
sub('''    do
    {
      try{
        line=in.readLine();''', '''    if (in != null) do
    {
      try{
        line=in.readLine();''')
sub('''    try
    {
      in.close();
    }''', '''    try
    {
      if (in != null) in.close();
    }''')

# Menus use WASD instead of the arrow keys (the menu code only runs on menu screens, so
# this can't clash with W/A/S/D steering in flight).
for arrow, key in (('UP', 'W'), ('DOWN', 'S'), ('LEFT', 'A'), ('RIGHT', 'D')):
    sub('if (keyCode == KeyEvent.VK_' + arrow + ') ', 'if (keyCode == KeyEvent.VK_' + key + ') ')

open(src, 'w', encoding='latin-1', newline='').write(t)
print('ok')

# ── Speed (the browser runtime renders in software, so per-frame pixel work is what lags) ──
if '--no-perf' not in sys.argv:
    t = open(src, encoding='latin-1').read()

    # 1. Convert every image once to the screen's pixel format (int RGB / premultiplied ARGB),
    #    so each frame is a plain copy instead of a per-pixel format conversion.
    sub('  static final String SAVES =', '''  static BufferedImage fast(BufferedImage src) {
    if (src == null) return null;
    int type = src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB_PRE : BufferedImage.TYPE_INT_RGB;
    BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), type);
    Graphics2D g = out.createGraphics();
    g.drawImage(src, 0, 0, null);
    g.dispose();
    return out;
  }
  /** Pre-sized copy for images the game always draws at one fixed size (no per-frame scaling). */
  static BufferedImage sized(BufferedImage src, int w, int h) {
    if (src == null) return null;
    BufferedImage out = new BufferedImage(w, h, src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB_PRE : BufferedImage.TYPE_INT_RGB);
    Graphics2D g = out.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
    g.drawImage(src, 0, 0, w, h, null);
    g.dispose();
    return out;
  }
  static final String SAVES =''')
    t, n4 = re.subn(r'ImageIO\.read\((new File\(ASSETS \+ "[^"]+"\))\)', r'fast(ImageIO.read(\1))', t)
    print('images converted at load:', n4)

    # 2. The two fixed-size draws that were rescaled every frame: pre-size them once.
    sub('g2.drawImage(TopGunMM,0,0,600,560,null);', 'g2.drawImage(TopGunMMs == null ? (TopGunMMs = sized(TopGunMM, 600, 560)) : TopGunMMs, 0, 0, null);')
    sub('g2.drawImage(Dashboard,0,300,600,236,null);', 'g2.drawImage(Dashboards == null ? (Dashboards = sized(Dashboard, 600, 236)) : Dashboards, 0, 300, null);')
    sub('  BufferedImage Controls=null;', '  BufferedImage Controls=null;\n  BufferedImage TopGunMMs=null, Dashboards=null; // pre-sized copies')
    # The animated menu jet (GIF) is drawn at 400x203: scale its frames once, keeping the animation.
    sub('JetMM = Toolkit.getDefaultToolkit().createImage(ASSETS + "Jet.gif");',
        'JetMM = Toolkit.getDefaultToolkit().createImage(ASSETS + "Jet.gif").getScaledInstance(400, 203, Image.SCALE_FAST);')
    sub('g2.drawImage(JetMM,232,352,400,203,null);', 'g2.drawImage(JetMM,232,352,null);')

    # 3. Favour speed over quality for whatever is still scaled (clouds, jets, explosions).
    sub('''      Graphics2D g2 = (Graphics2D)g;
''', '''      Graphics2D g2 = (Graphics2D)g;
      g2.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_SPEED);
      g2.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
      g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
''')
    open(src, 'w', encoding='latin-1', newline='').write(t)

# ── Optional FPS log for measuring (-Dtg.fps=1; the site passes it when the URL has ?fps):
#    counts frames actually painted (repaint() requests are merged when painting is slow).
t = open(src, encoding='latin-1').read()
sub('''    public void paintComponent(Graphics g) {
      Graphics2D g2 = (Graphics2D)g;
''', '''    public void paintComponent(Graphics g) {
      if (FPS_LOG) {
        fpsFrames++;
        long now = System.currentTimeMillis();
        if (now - fpsSince >= 2000) { System.out.println("[topgun] fps=" + (fpsFrames * 1000 / (now - fpsSince)) + " ticks=" + (fpsTicks * 1000 / (now - fpsSince)) + " game=" + game); fpsFrames = 0; fpsTicks = 0; fpsSince = now; }
      }
      Graphics2D g2 = (Graphics2D)g;
''')
sub('  static final String SAVES =', '  static final boolean FPS_LOG = System.getProperty("tg.fps") != null;\n'
    '  int fpsFrames = 0, fpsTicks = 0; long fpsSince = System.currentTimeMillis();\n'
    '  static final String SAVES =')
# ...and game-logic ticks (the loop aims for one every ~15 ms).
t, n5 = re.subn(r'(repaint\(\); *\r?\n)(\s*\r?\n\s*try\s*\{\s*Thread\.sleep \(15\);)', r'\1      if (FPS_LOG) fpsTicks++;\n\2', t)
assert n5 == 1, n5
open(src, 'w', encoding='latin-1', newline='').write(t)
print('perf ok')
