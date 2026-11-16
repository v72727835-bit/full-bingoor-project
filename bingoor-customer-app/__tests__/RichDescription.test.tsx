import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import { RichDescription } from '../src/components/RichDescription';
import { ThemeProvider } from '../src/theme';
import { light, dark } from '../src/theme/palette';

/** Every text colour the description paints, in either theme. */
function colorsFor(pref: 'light' | 'dark', text: string) {
  let r: ReturnType<typeof create>;
  act(() => { r = create(<ThemeProvider initialPreference={pref}><RichDescription text={text} /></ThemeProvider>); });
  return r!.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => StyleSheet.flatten(n.props.style)?.color);
}

const html = '<h3>About</h3><p>Pure <b>basmati</b> rice, <span style="color:#ffffff;font-size:14pt">aged 2 years</span>.</p><ul><li>No colour</li></ul>';

test.each([['light', light], ['dark', dark]] as const)('description text is readable on the %s surface', (mode, palette) => {
  for (const text of [html, 'Plain text description']) {
    const colors = colorsFor(mode, text);
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) {
      expect(c).toBeTruthy();
      expect(String(c).toLowerCase()).not.toBe(String(palette.surface).toLowerCase());
      expect(String(c).toLowerCase()).not.toBe('#ffffff' === palette.surface.toLowerCase() ? '#ffffff' : '#fff');
    }
  }
});
