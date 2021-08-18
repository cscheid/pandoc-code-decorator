export class PandocCodeDecorator
{
  constructor(node) {
    this._node = node;
    this._spans = [];
    this.normalizeCodeRange();
    
    // a sorted list of character offsets describing the start
    // of each <span> tag, used to binary search into the right elements.
    this.initializeEntryPoints();
  }

  // ensure there are no naked #text elements by replacing them
  // with unclassed spans
  normalizeCodeRange() {
    const n = this._node;
    const lines = n.querySelectorAll("code > span");
    for (const line of lines) {
      Array.from(line.childNodes)
        .filter(n => n.nodeType === n.TEXT_NODE)
        .forEach(n => {
          const newSpan = document.createElement("span");
          newSpan.innerText = n.wholeText;
          n.replaceWith(newSpan);
        });
    }
  }

  initializeEntryPoints() {
    const lines = this._node.querySelectorAll("code > span");
    let result = [];
    let offset = (this._node.parentElement.dataset.sourceOffset &&
                  -Number(this._node.parentElement.dataset.sourceOffset)) || 0;
    for (const line of lines) {
      Array.from(line.childNodes)
        .filter(n => n.nodeType === n.ELEMENT_NODE && n.nodeName === "SPAN")
        .forEach(n => {
          result.push({
            offset,
            node: n
          });
          // FIXME This might bite me wrt Unicode weirdness
          offset += n.innerText.length; 
        });
      offset += 1; // take line breaks into account
    }
    this._elementEntryPoints = result;
  }
  
  locateEntry(offset) {
    // FIXME use binary search here
    let candidate;
    for (let i = 0; i < this._elementEntryPoints.length; ++i) {
      const entry = this._elementEntryPoints[i];
      if (entry.offset > offset) {
        return { entry: candidate, index: i - 1 };
      }
      candidate = entry;
    }
    return undefined;
  };

  // make sure the span [start, end) happens
  // on element boundaries, splitting nodes
  // and updating _elementEntryPoints if needed
  ensureExactSpan(start, end) {
    const splitEntry = (entry, offset) => {
      const newSpan = document.createElement("span");
      for (const cssClass of entry.node.classList) {
        newSpan.classList.add(cssClass);
      }
      const beforeText = entry.node.innerText.slice(0, offset - entry.offset);
      const afterText = entry.node.innerText.slice(offset - entry.offset);
      entry.node.innerText = beforeText;
      newSpan.innerText = afterText;
      entry.node.after(newSpan);
      this._elementEntryPoints.push({
        offset,
        node: newSpan
      });
      this._elementEntryPoints.sort((a, b) => a.offset - b.offset);
    };

    const startEntry = this.locateEntry(start);
    if (startEntry !== undefined && startEntry.entry.offset != start) {
      splitEntry(startEntry.entry, start);
    }
    const endEntry = this.locateEntry(end);
    if (endEntry !== undefined && endEntry.entry.offset !== end) {
      splitEntry(endEntry.entry, end);
    }
  }

  decorateSpan(start, end, classes) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === undefined) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = (endEntry && endEntry.index) || this._elementEntryPoints.length;
    for (let i = startIndex; i < endIndex; ++i) {
      for (const cssClass of classes) {
        this._elementEntryPoints[i].node.classList.add(cssClass);
      }
    }
  }
}

