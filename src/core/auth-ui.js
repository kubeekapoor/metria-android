/* Pantallas de acceso: crear cuenta, desbloquear, recuperar y contraseña nueva.
 * Replica el flujo de login.html de Electron en una sola página (Android no
 * abre ventanas separadas).
 */

const nextPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

export class AuthUI {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.version = handlers.version || '1.0.0';
  }

  setVersion(v) {
    this.version = v || this.version;
    const el = this.root.querySelector('[data-version]');
    if (el) el.textContent = `Metría v${this.version}`;
  }

  shell(title, subtitle, body, footer = '') {
    this.root.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-brand">Metría</div>
          <h1>${title}</h1>
          <p class="sub">${subtitle}</p>
          ${body}
          <div class="error" data-error></div>
          ${footer}
        </div>
        <div class="auth-ver" data-version>Metría v${this.version}</div>
      </div>`;
    return {
      error: this.root.querySelector('[data-error]'),
      form: this.root.querySelector('form'),
    };
  }

  async run(button, errorEl, fn) {
    errorEl.textContent = '';
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Derivando clave…';
    await nextPaint();
    let res;
    try {
      res = await fn();
    } catch (e) {
      console.error(e);
      res = { ok: false, error: 'No se pudo completar la operación.' };
    }
    if (!res || !res.ok) {
      button.disabled = false;
      button.textContent = label;
      errorEl.textContent = (res && res.error) || 'No se pudo completar la operación.';
      return null;
    }
    return res;
  }

  showUnlock(reason = '') {
    const why = reason === 'idle'
      ? 'Tu sesión se bloqueó por inactividad. '
      : reason === 'system'
        ? 'Tu sesión se bloqueó al salir de la app. '
        : '';
    const { form, error } = this.shell(
      'Ingresa tu contraseña',
      `${why}Escribe tu contraseña maestra para abrir tus datos.`,
      `<form id="f" autocomplete="off">
        <label for="password">Contraseña</label>
        <input type="password" id="password" autocomplete="current-password" required>
        <button type="submit" class="primary">Entrar</button>
      </form>`,
      `<button type="button" class="linkbtn" data-forgot>¿Olvidaste tu contraseña?</button>`,
    );
    const button = form.querySelector('button[type=submit]');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const password = form.querySelector('#password').value;
      const res = await this.run(button, error, () => this.h.onUnlock(password));
      if (res && res.ok) this.h.onEnterApp();
    });
    this.root.querySelector('[data-forgot]').addEventListener('click', () => this.showRecover());
    form.querySelector('#password').focus();
  }

  showCreate() {
    const { form, error } = this.shell(
      'Crea tu contraseña',
      'Protege tus datos financieros con una contraseña maestra (mínimo 8 caracteres).',
      `<form id="f" autocomplete="off">
        <label for="password">Contraseña</label>
        <input type="password" id="password" autocomplete="new-password" minlength="8" required>
        <label for="confirm">Confirmar contraseña</label>
        <input type="password" id="confirm" autocomplete="new-password" required>
        <button type="submit" class="primary">Crear y entrar</button>
      </form>`,
      `<p class="hint">Al crear tu cuenta te daremos una frase de recuperación. Guárdala en un gestor de contraseñas.</p>`,
    );
    const button = form.querySelector('button[type=submit]');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const password = form.querySelector('#password').value;
      const confirm = form.querySelector('#confirm').value;
      const res = await this.run(button, error, () => this.h.onCreate(password, confirm));
      if (res && res.ok && res.recoveryKey) this.showRecoveryPhrase(res.recoveryKey);
    });
    form.querySelector('#password').focus();
  }

  showRecoveryPhrase(recoveryKey) {
    const { form, error } = this.shell(
      'Tu frase de recuperación',
      'Si olvidas tu contraseña, esta frase es la única forma de recuperar tus datos. No se puede volver a mostrar.',
      `<div class="recovery-box" data-phrase></div>
       <div class="warn">Guárdala en un gestor de contraseñas o en un lugar seguro fuera del teléfono. Cualquiera que tenga esta frase puede abrir tus datos financieros.</div>
       <div class="check-row">
         <input type="checkbox" id="confirmed">
         <label for="confirmed">Ya guardé mi frase de recuperación en un lugar seguro.</label>
       </div>
       <form id="f"><button type="submit" class="primary" disabled>Continuar</button></form>`,
    );
    this.root.querySelector('[data-phrase]').textContent = recoveryKey;
    const check = this.root.querySelector('#confirmed');
    const button = form.querySelector('button[type=submit]');
    check.addEventListener('change', () => { button.disabled = !check.checked; });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const res = await this.run(button, error, () => this.h.onConfirmRecovery());
      if (res && res.ok) this.h.onEnterApp();
    });
  }

  showRecover() {
    const { form, error } = this.shell(
      'Recuperar acceso',
      'Ingresa tu frase de recuperación (la que guardaste al crear tu cuenta).',
      `<form id="f" autocomplete="off">
        <label for="recoveryKey">Frase de recuperación</label>
        <input type="text" id="recoveryKey" class="mono" placeholder="XXXX-XXXX-XXXX-…" autocapitalize="characters" autocomplete="off" required>
        <button type="submit" class="primary">Continuar</button>
      </form>`,
      `<button type="button" class="linkbtn" data-back>Volver a ingresar con contraseña</button>`,
    );
    const button = form.querySelector('button[type=submit]');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const key = form.querySelector('#recoveryKey').value;
      const res = await this.run(button, error, () => this.h.onRecover(key));
      if (res && res.ok) this.showNewPassword();
    });
    this.root.querySelector('[data-back]').addEventListener('click', () => this.showUnlock());
    form.querySelector('#recoveryKey').focus();
  }

  showNewPassword() {
    const { form, error } = this.shell(
      'Define una contraseña nueva',
      'Tus datos ya están accesibles. Ahora define la contraseña que usarás de aquí en adelante (mínimo 8 caracteres).',
      `<form id="f" autocomplete="off">
        <label for="password">Contraseña nueva</label>
        <input type="password" id="password" autocomplete="new-password" minlength="8" required>
        <label for="confirm">Confirmar contraseña</label>
        <input type="password" id="confirm" autocomplete="new-password" required>
        <button type="submit" class="primary">Guardar y entrar</button>
      </form>`,
    );
    const button = form.querySelector('button[type=submit]');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const password = form.querySelector('#password').value;
      const confirm = form.querySelector('#confirm').value;
      const res = await this.run(button, error, () => this.h.onSetNewPassword(password, confirm));
      if (res && res.ok) this.h.onEnterApp();
    });
    form.querySelector('#password').focus();
  }

  showError(message) {
    this.root.innerHTML = `
      <div class="auth-wrap"><div class="auth-card">
        <div class="auth-brand">Metría</div>
        <h1>No se pudo abrir</h1>
        <p class="sub">${message}</p>
      </div></div>`;
  }
}
