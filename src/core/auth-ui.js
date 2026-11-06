/* Pantallas de acceso: crear cuenta, desbloquear, recuperar y contraseña nueva.
 * Replica el flujo de login.html de Electron en una sola página (Android no
 * abre ventanas separadas).
 */

const nextPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

/* La marca de Metria: monograma M plegado, igual que el ícono de la app. */
const BRAND_MARK = `<svg class="brand-mark auth-logo" viewBox="0 0 64 64" aria-hidden="true">
  <polygon points="0,7.7 9,2.6 9,58.9 0,64" fill="var(--auth-accent)" opacity=".72"/>
  <polygon points="9,2.6 32,28.2 32,35.8 9,10.2" fill="var(--auth-accent)"/>
  <polygon points="32,28.2 55,2.6 55,10.2 32,35.8" fill="var(--auth-accent)" opacity=".86"/>
  <polygon points="55,2.6 64,7.7 64,64 55,58.9" fill="var(--auth-accent)" opacity=".62"/>
</svg>`;
const BRAND = `<div class="auth-brand">${BRAND_MARK}<span>METRIA</span></div>`;

export class AuthUI {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.version = handlers.version || '1.2.0';
    this.lastBiometric = { enabled: false };
    this.bioTimer = null;
  }

  setVersion(v) {
    this.version = v || this.version;
    const el = this.root.querySelector('[data-version]');
    if (el) el.textContent = `Metria v${this.version}`;
  }

  shell(title, subtitle, body, footer = '') {
    clearTimeout(this.bioTimer);
    this.bioTimer = null;
    this.root.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          ${BRAND}
          <h1>${title}</h1>
          <p class="sub">${subtitle}</p>
          ${body}
          <div class="error" data-error></div>
          ${footer}
        </div>
        <div class="auth-ver" data-version>Metria v${this.version}</div>
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

  showUnlock(reason = '', biometric = this.lastBiometric || {}) {
    this.lastBiometric = biometric;
    const why = reason === 'idle'
      ? 'Tu sesión se bloqueó por inactividad. '
      : reason === 'system'
        ? 'Tu sesión se bloqueó al salir de la app. '
        : '';
    const canBio = !!(biometric && biometric.enabled && biometric.available !== false && !biometric.requiresPassword);
    const bioBlock = canBio
      ? `<button type="button" class="primary" data-biometric>Desbloquear con huella o rostro</button>
         <p class="hint" style="text-align:center;margin:12px 0 0;">o usa tu contraseña</p>`
      : '';
    const passwordOnce = biometric && biometric.enabled && biometric.requiresPassword
      ? `<p class="hint" style="margin:0 0 12px;">Después de reiniciar el teléfono, ingresa tu contraseña una vez. Luego podrás volver a usar la biometría.</p>`
      : '';
    const { form, error } = this.shell(
      'Ingresa tu contraseña',
      `${why}Escribe tu contraseña maestra para abrir tus datos.`,
      `${passwordOnce}${bioBlock}<form id="f" autocomplete="on">
        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required>
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

    const bioBtn = this.root.querySelector('[data-biometric]');
    const tryBiometric = async () => {
      if (!bioBtn || !this.h.onBiometricUnlock) return;
      error.textContent = '';
      const label = bioBtn.textContent;
      bioBtn.disabled = true;
      bioBtn.textContent = 'Esperando huella…';
      let res;
      try {
        res = await this.h.onBiometricUnlock();
      } catch (e) {
        console.error(e);
        res = { ok: false, error: 'No se pudo desbloquear con biometría.' };
      }
      if (res && res.ok) {
        this.h.onEnterApp();
        return;
      }
      bioBtn.disabled = false;
      bioBtn.textContent = label;
      if (res && res.code !== 'CANCELLED') {
        error.textContent = (res && res.error) || 'No se pudo desbloquear con biometría.';
      }
      const input = form.querySelector('#password');
      if (input) input.focus();
    };
    if (bioBtn) {
      bioBtn.addEventListener('click', tryBiometric);
      /* Al abrir la pantalla se ofrece la biometría una sola vez; si se
         cancela, el usuario puede tocar el botón o escribir la contraseña.
         Si la página se recargó mientras la app estaba en segundo plano, se
         espera a que vuelva a estar visible para no abrir el diálogo encima de
         otra aplicación. */
      const requestBiometric = () => {
        if (document.visibilityState === 'visible') {
          tryBiometric();
          return;
        }
        const onVisible = () => {
          if (document.visibilityState !== 'visible') return;
          document.removeEventListener('visibilitychange', onVisible);
          if (bioBtn.isConnected) tryBiometric();
        };
        document.addEventListener('visibilitychange', onVisible);
      };
      this.bioTimer = setTimeout(() => {
        this.bioTimer = null;
        if (bioBtn.isConnected) requestBiometric();
      }, 350);
    }

    form.querySelector('#password').focus();
  }

  showCreate() {
    const { form, error } = this.shell(
      'Crea tu contraseña',
      'Protege tus datos financieros con una contraseña maestra (mínimo 8 caracteres).',
      `<form id="f" autocomplete="on">
        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" autocomplete="new-password" minlength="8" autocapitalize="none" autocorrect="off" spellcheck="false" required>
        <label for="confirm">Confirmar contraseña</label>
        <input type="password" id="confirm" name="confirm" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" required>
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
        <input type="text" id="recoveryKey" name="recoveryKey" class="mono" placeholder="XXXX-XXXX-XXXX-…" autocapitalize="characters" autocomplete="off" spellcheck="false" required>
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
      `<form id="f" autocomplete="on">
        <label for="password">Contraseña nueva</label>
        <input type="password" id="password" name="password" autocomplete="new-password" minlength="8" autocapitalize="none" autocorrect="off" spellcheck="false" required>
        <label for="confirm">Confirmar contraseña</label>
        <input type="password" id="confirm" name="confirm" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" required>
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
        ${BRAND}
        <h1>No se pudo abrir</h1>
        <p class="sub">${message}</p>
      </div></div>`;
  }
}
