import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateCssSelector, generateXPath } from '../selectorGenerator';

function createElement(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') {
      el.className = value;
    } else {
      el.setAttribute(key, value);
    }
  }
  return el;
}

describe('generateCssSelector', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('uses ID selector when element has an id', () => {
    // #given
    const el = createElement('div', { id: 'my-element' });
    container.appendChild(el);

    // #when
    const selector = generateCssSelector(el);

    // #then
    expect(selector).toBe('#my-element');
  });

  it('escapes special characters in IDs', () => {
    // #given
    const el = createElement('div', { id: 'foo:bar' });
    container.appendChild(el);

    // #when
    const selector = generateCssSelector(el);

    // #then
    expect(selector).toBe('#foo\\:bar');
  });

  it('uses unique class combination when no ID is present', () => {
    // #given
    const el = createElement('button', { class: 'play-btn primary' });
    container.appendChild(el);

    // #when
    const selector = generateCssSelector(el);

    // #then
    expect(selector).toBe('.play-btn.primary');
  });

  it('falls back to nth-child path when classes are not unique', () => {
    // #given
    const el1 = createElement('div', { class: 'item' });
    const el2 = createElement('div', { class: 'item' });
    container.appendChild(el1);
    container.appendChild(el2);

    // #when
    const selector = generateCssSelector(el2);

    // #then
    expect(selector).toContain('div');
    expect(selector).not.toBe('.item');
  });

  it('generates nth-child path for element without id or unique class', () => {
    // #given
    const wrapper = createElement('section');
    const el = createElement('p');
    wrapper.appendChild(createElement('p'));
    wrapper.appendChild(el);
    container.appendChild(wrapper);

    // #when
    const selector = generateCssSelector(el);

    // #then
    expect(selector).toContain('p:nth-child');
  });

  it('omits nth-child when element is the only sibling of its tag', () => {
    // #given
    const wrapper = createElement('nav');
    const el = createElement('ul');
    wrapper.appendChild(el);
    container.appendChild(wrapper);

    // #when
    const selector = generateCssSelector(el);

    // #then
    expect(selector).not.toContain(':nth-child');
    expect(selector).toContain('ul');
  });
});

describe('generateXPath', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('generates an absolute XPath starting with /', () => {
    // #given
    const el = createElement('span');
    container.appendChild(el);

    // #when
    const xpath = generateXPath(el);

    // #then
    expect(xpath).toMatch(/^\//);
  });

  it('includes tag name in XPath', () => {
    // #given
    const el = createElement('article');
    container.appendChild(el);

    // #when
    const xpath = generateXPath(el);

    // #then
    expect(xpath).toContain('article');
  });

  it('adds index when multiple siblings of same tag exist', () => {
    // #given
    const el1 = createElement('li');
    const el2 = createElement('li');
    const el3 = createElement('li');
    container.appendChild(el1);
    container.appendChild(el2);
    container.appendChild(el3);

    // #when
    const xpath = generateXPath(el2);

    // #then
    expect(xpath).toContain('li[2]');
  });

  it('omits index when element is the only sibling of its tag', () => {
    // #given
    const wrapper = createElement('main');
    const el = createElement('header');
    wrapper.appendChild(el);
    container.appendChild(wrapper);

    // #when
    const xpath = generateXPath(el);

    // #then
    expect(xpath).not.toMatch(/header\[\d+\]/);
    expect(xpath).toContain('header');
  });

  it('can resolve element via document.evaluate', () => {
    // #given
    const wrapper = createElement('section');
    const el = createElement('p');
    wrapper.appendChild(createElement('p'));
    wrapper.appendChild(el);
    container.appendChild(wrapper);
    el.textContent = 'target';

    // #when
    const xpath = generateXPath(el);
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);

    // #then
    expect(result.singleNodeValue).toBe(el);
  });
});
