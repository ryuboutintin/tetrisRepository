class Input {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this._handler  = this._onKey.bind(this);
  }

  bind()   { document.addEventListener('keydown', this._handler); }
  unbind() { document.removeEventListener('keydown', this._handler); }

  _onKey(e) {
    const { onLeft, onRight, onDown, onUp, onSpace } = this.callbacks;
    switch (e.code) {
      case 'ArrowLeft':  e.preventDefault(); onLeft();  break;
      case 'ArrowRight': e.preventDefault(); onRight(); break;
      case 'ArrowDown':  e.preventDefault(); onDown();  break;
      case 'ArrowUp':    e.preventDefault(); onUp();    break;
      case 'Space':      e.preventDefault(); onSpace(); break;
    }
  }
}
