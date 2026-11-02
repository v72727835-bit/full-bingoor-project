#!/usr/bin/env python3
"""
A tiny Android UI driver for the app smoke test (adb + uiautomator2).

Each command line in a flow file is one step:
    wait <seconds>
    tap <regex>            tap the element whose text or description matches; retried until the screen changes
    tapif <regex>          same, but skip quietly if it is not on screen
    type <regex> <text>    fill the input box (matched by its hint, or the label above it) and check it took
    typekeep <regex> <txt> the same, but leave the keyboard open (inside a sheet, "back" would close the sheet)
    reveal <box> <button> [<entry>]  tap the button only if that input box is not on screen yet (forms behind
                           a toggle); if the app is back on its first screen, tap <entry> to come back
    see <regex>            fail unless it shows up on screen within ~15 s
    gone <regex>           fail unless it has left the screen within ~15 s
    key <name>             e.g. back, enter
    hidekb                 close the on-screen keyboard if it is open
    dump <name>            save the screen's view tree to out/<name>.xml
    swipeup                scroll the screen up once
    shot <name>            screenshot to out/<name>.png
    alive                  fail if the app process has died
Every step also checks the app is still running and saves a screenshot when it is not.

Emulators are slow and React Native screens keep animating, so every action is
verified: a tap is repeated until the screen changes, and typed text is read
back from the box and re-entered if keys were dropped.
"""
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

BOUNDS = re.compile(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
failures = []
DEVICE = None  # uiautomator2 device, set in main()
PKG = ''
OUT = 'out'


def adb(*args, check=True):
    r = subprocess.run(['adb', *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        print('adb', args, 'failed:', r.stderr.strip())
    return r.stdout


def shot(name):
    with open(os.path.join(OUT, f'{name}.png'), 'wb') as f:
        f.write(subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True).stdout)


def alive():
    return bool(adb('shell', 'pidof', PKG, check=False).strip())


def keyboard_open():
    return 'mInputShown=true' in adb('shell', 'dumpsys', 'input_method', check=False)


def hide_keyboard():
    # A bare "back" with no keyboard open would leave the screen, so check first.
    if keyboard_open():
        adb('shell', 'input', 'keyevent', '4')
        time.sleep(1)


# ---------------------------------------------------------------- screen tree

def hierarchy():
    # Plain `uiautomator dump` waits for an idle state that animated RN screens
    # never reach; uiautomator2 does not wait.
    if DEVICE is not None:
        try:
            return DEVICE.dump_hierarchy(compressed=False)
        except Exception as e:
            print('  dump_hierarchy failed:', e)
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml', check=False)
    return adb('shell', 'cat', '/sdcard/ui.xml', check=False)


def parse(xml):
    try:
        root = ET.fromstring(xml[xml.find('<'):]) if '<' in xml else None
    except ET.ParseError:
        return []
    return list(root.iter('node')) if root is not None else []


def nodes():
    return parse(hierarchy())


def label(n, with_hint=True):
    parts = [n.get('text'), n.get('content-desc')] + ([n.get('hint')] if with_hint else [])
    return ' '.join(p for p in parts if p)


def center(n):
    m = BOUNDS.match(n.get('bounds', ''))
    if not m:
        return None
    x1, y1, x2, y2 = map(int, m.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def is_box(n):
    return 'EditText' in (n.get('class') or '')


def signature(ns):
    """What the app shows, to tell whether a tap did anything (the status-bar clock does not count)."""
    return tuple(sorted({
        label(n, with_hint=False) for n in ns
        if label(n, with_hint=False) and (n.get('package') or '') != 'com.android.systemui'
    }))


# System dialogs that cover the app: the text that identifies one, and the button to press.
SYSTEM_DIALOGS = [
    ("isn't responding", 'Wait'),                           # the emulator is slow to boot
    ('always run in background', 'Allow'),                  # the app asks to skip battery saving (loud ring)
    ('Allow .* to send you notifications', 'Allow'),
    ("Allow .* to access this device's location", 'While using the app'),
]


def clear_system_dialogs(ns):
    for marker, button in SYSTEM_DIALOGS:
        rx = re.compile(marker, re.I)
        if any(rx.search(n.get('text') or '') for n in ns):
            for n in ns:
                if (n.get('text') or '').strip().lower() == button.lower() and center(n):
                    print(f'  (system dialog "{marker}": pressing {button})')
                    adb('shell', 'input', 'tap', *map(str, center(n)))
                    time.sleep(1.5)
                    return True
    return False


def matches(n, rx):
    """True when the text, the description or the hint matches on its own, or all of them joined.
    An empty box reports its hint as its text too, so a joined "•••• ••••" must not hide a "^••••$"."""
    parts = [p for p in (n.get('text'), n.get('content-desc'), n.get('hint')) if p]
    return any(rx.search(p) for p in parts) or (len(parts) > 1 and bool(rx.search(' '.join(parts))))


def find_node(ns, pattern):
    rx = re.compile(pattern, re.I)
    return next((n for n in ns if matches(n, rx) and center(n)), None)


def find_box(ns, pattern):
    """The input box whose hint/text matches, or else the first box after a matching label."""
    rx = re.compile(pattern, re.I)
    boxes = [n for n in ns if is_box(n) and center(n)]
    hit = next((b for b in boxes if matches(b, rx)), None)
    if hit is not None:
        return hit
    after = False
    for n in ns:
        if not after and not is_box(n) and matches(n, rx):
            after = True
        elif after and is_box(n) and center(n):
            return n
    return None


LAUNCHER = re.compile(r'launcher', re.I)


def bring_app_back(ns):
    """A freshly booted emulator sometimes sends the app to the background (a system app updates
    and Android recreates every activity). If the home screen is showing instead of the app,
    open the app again. Returns True when it did."""
    if not PKG or not ns:
        return False
    packages = {n.get('package') or '' for n in ns}
    if PKG in packages or not any(LAUNCHER.search(p) for p in packages):
        return False
    print('  (the app went to the background - opening it again)')
    adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1', check=False)
    time.sleep(4)
    return True


def fresh_nodes():
    ns = nodes()
    if clear_system_dialogs(ns) or bring_app_back(ns):
        return nodes()
    return ns


# ------------------------------------------------------------------- actions

def tap(pattern, optional=False):
    """Tap the element; if the screen does not change, tap again (up to 3 times)."""
    for _ in range(10):  # wait up to ~15 s for it to appear
        ns = fresh_nodes()
        target = find_node(ns, pattern)
        if target is None:
            time.sleep(1.5)
            continue
        before = signature(ns)
        for attempt in range(3):
            adb('shell', 'input', 'tap', *map(str, center(target)))
            time.sleep(2)
            after_ns = fresh_nodes()
            if signature(after_ns) != before or find_node(after_ns, pattern) is None:
                return True
            if attempt < 2:
                print(f'  (screen did not change, tapping again: {attempt + 2}/3)')
            again = find_node(after_ns, pattern)
            target = again if again is not None else target
        return True  # tapped; some taps (a toggle, a field) do not change the text on screen
    if not optional:
        failures.append(f'not found on screen: {pattern}')
        print('  !! not found:', pattern)
    return False


def reveal(box_pattern, button_pattern, entry_pattern=None):
    """Tap a button (once) only when the input box is not on screen yet, e.g. a form behind a toggle.

    entry_pattern: the way onto this screen (e.g. "I already have an account"). If Android
    recreated the app and it is back on its first screen, that is tapped again.
    """
    for _ in range(8):
        ns = fresh_nodes()
        if find_box(ns, box_pattern) is not None:
            return True
        entry = find_node(ns, entry_pattern) if entry_pattern else None
        if entry is not None:
            print('  (back on the first screen, going in again)')
            adb('shell', 'input', 'tap', *map(str, center(entry)))
            time.sleep(2.5)
            continue
        button = find_node(ns, button_pattern)
        if button is not None:
            adb('shell', 'input', 'tap', *map(str, center(button)))
            time.sleep(2)
            if find_box(fresh_nodes(), box_pattern) is not None:
                return True
        time.sleep(1.5)
    failures.append(f'input box never appeared: {box_pattern}')
    print('  !! input box never appeared:', box_pattern)
    return False


def see(pattern, present=True):
    """Wait for an element to appear (present) or disappear; record a failure if it never does."""
    for _ in range(10):
        if (find_node(fresh_nodes(), pattern) is not None) == present:
            return True
        time.sleep(1.5)
    msg = f'{"never appeared" if present else "still on screen"}: {pattern}'
    failures.append(msg)
    print('  !!', msg)
    return False


def box_text(pattern):
    n = find_box(fresh_nodes(), pattern)
    return None if n is None else (n.get('text') or '')


def type_into(pattern, text, hide=True):
    """Fill the box and read it back; retry, then fall back to typing key by key."""
    for attempt in range(3):
        ns = fresh_nodes()
        box = find_box(ns, pattern)
        if box is None:
            time.sleep(1.5)
            continue
        secret = box.get('password') == 'true'
        adb('shell', 'input', 'tap', *map(str, center(box)))
        time.sleep(0.8)
        filled = False
        if DEVICE is not None:
            try:
                # Sets the text directly on the focused box: no dropped keys.
                DEVICE(focused=True).set_text(text)
                filled = True
            except Exception as e:
                print('  set_text failed, typing key by key:', e)
        if not filled:
            adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
            for _ in range(40):
                adb('shell', 'input', 'keyevent', '67')  # delete what is there
            for ch in text:
                adb('shell', 'input', 'text', '%s' if ch == ' ' else ch)
                time.sleep(0.15)
        time.sleep(0.8)
        if hide:
            hide_keyboard()
        if secret:
            # A password box shows dots; check the length when it is exposed, else trust it.
            got = box_text(pattern) or ''
            if not got or len(got) == len(text) or got == box.get('hint'):
                return True
        elif box_text(pattern) == text:
            return True
        print(f'  (text did not take, retrying {attempt + 2}/3)')
    failures.append(f'could not type into: {pattern}')
    print('  !! could not type into:', pattern)
    return False


# ---------------------------------------------------------------------- main

def run(flow):
    step = 0
    for raw in open(flow, encoding='utf-8'):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        step += 1
        cmd, _, rest = line.partition(' ')
        print(f'[{step}] {line}', flush=True)
        if cmd == 'wait':
            time.sleep(float(rest))
        elif cmd in ('tap', 'tapif'):
            tap(rest, optional=cmd == 'tapif')
        elif cmd in ('type', 'typekeep'):
            pattern, _, text = rest.partition(' ')
            type_into(pattern, text, hide=cmd == 'type')
        elif cmd == 'reveal':
            box_pattern, button_pattern, *entry = rest.split(' ')
            reveal(box_pattern, button_pattern, entry[0] if entry else None)
        elif cmd in ('see', 'gone'):
            see(rest, present=cmd == 'see')
        elif cmd == 'hidekb':
            hide_keyboard()
        elif cmd == 'dump':
            with open(os.path.join(OUT, f'{rest or "screen"}.xml'), 'w', encoding='utf-8') as f:
                f.write(hierarchy())
        elif cmd == 'key':
            adb('shell', 'input', 'keyevent', {'back': '4', 'enter': '66'}.get(rest, rest))
            time.sleep(1)
        elif cmd == 'swipeup':
            adb('shell', 'input', 'swipe', '540', '1700', '540', '700', '400')
            time.sleep(1)
        elif cmd == 'shot':
            shot(rest)
        if not alive():
            failures.append(f'APP CRASHED after step {step}: {line}')
            print('  !! APP IS NOT RUNNING after:', line, flush=True)
            shot(f'crash-step{step}')
            break


def main():
    global DEVICE, PKG, OUT
    PKG, flow = sys.argv[1], sys.argv[2]
    OUT = sys.argv[3] if len(sys.argv) > 3 else 'out'
    os.makedirs(OUT, exist_ok=True)
    try:
        import uiautomator2 as u2
        DEVICE = u2.connect()
    except Exception as e:
        print('uiautomator2 unavailable, falling back to uiautomator dump:', e)
    run(flow)
    print('\nRESULT:', 'OK' if not failures else 'FAILED')
    for f in failures:
        print(' -', f)
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
