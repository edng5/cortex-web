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
