package com.kubeekapoor.metria;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyStore;
import java.security.UnrecoverableKeyException;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Desbloqueo rápido con huella o rostro.
 *
 * La contraseña maestra NO se guarda: se cifra con una llave AES-256 del
 * Android Keystore que exige una autenticación biométrica por uso. Si se
 * añade una biometría nueva al teléfono, el Keystore invalida la llave y el
 * desbloqueo biométrico se desactiva solo; la contraseña sigue funcionando.
 */
@CapacitorPlugin(name = "MetriaBiometric")
public class MetriaBiometricPlugin extends Plugin {

    private static final String PREFS = "metria_biometric";
    private static final String PREF_IV = "iv";
    private static final String PREF_CIPHERTEXT = "ciphertext";
    private static final String PREF_BOOT_COUNT = "boot_count";
    private static final String KEY_ALIAS = "metria_biometric_key";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int MASTER_KEY_BYTES = 32;
    private static final int GCM_TAG_BITS = 128;

    private boolean promptInProgress = false;

    @PluginMethod
    public void status(PluginCall call) {
        int can = canAuthenticate();
        JSObject ret = new JSObject();
        ret.put("supported", true);
        ret.put("available", can == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("enabled", hasEnrollment());
        ret.put("requiresPassword", requiresPasswordAfterReboot());
        ret.put("reason", reasonFor(can));
        call.resolve(ret);
    }

    @PluginMethod
    public void enroll(PluginCall call) {
        if (getActivity() == null) {
            fail(call, "NO_ACTIVITY", "La app no está disponible.");
            return;
        }
        if (!ensureBiometric(call)) return;

        byte[] masterKey = decodeMasterKey(call);
        if (masterKey == null) return;
        if (promptInProgress) {
            Arrays.fill(masterKey, (byte) 0);
            fail(call, "BUSY", "Ya hay una verificación en curso.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                // Si ya había una inscripción, se reemplaza por una nueva.
                deleteEnrollment();
                SecretKey key = createKey();
                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(Cipher.ENCRYPT_MODE, key);
                byte[] iv = cipher.getIV();

                promptInProgress = true;
                BiometricPrompt prompt = new BiometricPrompt(
                        getActivity(),
                        ContextCompat.getMainExecutor(getContext()),
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                promptInProgress = false;
                                try {
                                    BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                                    if (crypto == null || crypto.getCipher() == null) {
                                        fail(call, "CRYPTO", "No se pudo preparar el cifrado.");
                                        return;
                                    }
                                    byte[] ciphertext = crypto.getCipher().doFinal(masterKey);
                                    saveEnrollment(iv, ciphertext);
                                    markUnlocked();
                                    JSObject ret = new JSObject();
                                    ret.put("ok", true);
                                    call.resolve(ret);
                                } catch (Exception e) {
                                    fail(call, "CRYPTO", "No se pudo activar el desbloqueo biométrico.");
                                } finally {
                                    Arrays.fill(masterKey, (byte) 0);
                                }
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                promptInProgress = false;
                                Arrays.fill(masterKey, (byte) 0);
                                deleteEnrollment();
                                fail(call, errorCodeFor(errorCode), errString.toString());
                            }
                        });
                prompt.authenticate(promptInfo(), new BiometricPrompt.CryptoObject(cipher));
            } catch (Exception e) {
                promptInProgress = false;
                Arrays.fill(masterKey, (byte) 0);
                fail(call, "CRYPTO", "No se pudo activar el desbloqueo biométrico.");
            }
        });
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        if (getActivity() == null) {
            fail(call, "NO_ACTIVITY", "La app no está disponible.");
            return;
        }
        if (!ensureBiometric(call)) return;
        if (!hasEnrollment()) {
            fail(call, "NOT_ENROLLED", "El desbloqueo biométrico no está activado.");
            return;
        }
        if (requiresPasswordAfterReboot()) {
            fail(call, "PASSWORD_REQUIRED",
                    "Por seguridad, ingresa tu contraseña una vez después de reiniciar el teléfono.");
            return;
        }
        if (promptInProgress) {
            fail(call, "BUSY", "Ya hay una verificación en curso.");
            return;
        }

        byte[] iv;
        byte[] ciphertext;
        Cipher cipher;
        try {
            SharedPreferences prefs = prefs();
            iv = Base64.decode(prefs.getString(PREF_IV, ""), Base64.NO_WRAP);
            ciphertext = Base64.decode(prefs.getString(PREF_CIPHERTEXT, ""), Base64.NO_WRAP);
            SecretKey key = loadKey();
            cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        } catch (KeyPermanentlyInvalidatedException | UnrecoverableKeyException e) {
            deleteEnrollment();
            fail(call, "INVALIDATED", invalidatedMessage());
            return;
        } catch (Exception e) {
            deleteEnrollment();
            fail(call, "CRYPTO", "No se pudo preparar el desbloqueo biométrico.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            promptInProgress = true;
            BiometricPrompt prompt = new BiometricPrompt(
                    getActivity(),
                    ContextCompat.getMainExecutor(getContext()),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            promptInProgress = false;
                            byte[] plain = null;
                            try {
                                BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                                if (crypto == null || crypto.getCipher() == null) {
                                    fail(call, "CRYPTO", "No se pudo desbloquear.");
                                    return;
                                }
                                plain = crypto.getCipher().doFinal(ciphertext);
                                markUnlocked();
                                JSObject ret = new JSObject();
                                ret.put("ok", true);
                                ret.put("key", Base64.encodeToString(plain, Base64.NO_WRAP));
                                call.resolve(ret);
                            } catch (Exception e) {
                                deleteEnrollment();
                                fail(call, "CRYPTO", "No se pudo desbloquear con biometría.");
                            } finally {
                                if (plain != null) Arrays.fill(plain, (byte) 0);
                            }
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            promptInProgress = false;
                            fail(call, errorCodeFor(errorCode), errString.toString());
                        }
                    });
            prompt.authenticate(promptInfo(), new BiometricPrompt.CryptoObject(cipher));
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        deleteEnrollment();
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    /* La pantalla de acceso avisa cuando el usuario entró con su contraseña o
       frase de recuperación. Así, tras reiniciar, la biometría vuelve a estar
       disponible para el resto de la sesión de arranque. */
    @PluginMethod
    public void noteUnlock(PluginCall call) {
        markUnlocked();
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    private boolean ensureBiometric(PluginCall call) {
        int can = canAuthenticate();
        if (can == BiometricManager.BIOMETRIC_SUCCESS) return true;
        fail(call, reasonFor(can), messageFor(can));
        return false;
    }

    private int canAuthenticate() {
        return BiometricManager.from(getContext())
                .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
    }

    private byte[] decodeMasterKey(PluginCall call) {
        String encoded = call.getString("key");
        if (encoded == null) {
            fail(call, "MISSING_KEY", "Falta la llave maestra.");
            return null;
        }
        byte[] key;
        try {
            key = Base64.decode(encoded, Base64.NO_WRAP);
        } catch (IllegalArgumentException e) {
            fail(call, "BAD_KEY", "La llave maestra no es válida.");
            return null;
        }
        if (key.length != MASTER_KEY_BYTES) {
            Arrays.fill(key, (byte) 0);
            fail(call, "BAD_KEY", "La llave maestra no es válida.");
            return null;
        }
        return key;
    }

    private BiometricPrompt.PromptInfo promptInfo() {
        return new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Desbloquear Metria")
                .setSubtitle("Usa tu huella o rostro")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .setNegativeButtonText("Usar contraseña")
                .setConfirmationRequired(false)
                .build();
    }

    private SecretKey createKey() throws Exception {
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        } else {
            builder.setUserAuthenticationValidityDurationSeconds(-1);
        }

        generator.init(builder.build());
        return generator.generateKey();
    }

    private SecretKey loadKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    private boolean hasEnrollment() {
        SharedPreferences prefs = prefs();
        if (!prefs.contains(PREF_IV) || !prefs.contains(PREF_CIPHERTEXT)) return false;
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            return keyStore.containsAlias(KEY_ALIAS);
        } catch (Exception e) {
            return false;
        }
    }

    private void saveEnrollment(byte[] iv, byte[] ciphertext) {
        prefs().edit()
                .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(PREF_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .apply();
    }

    private void deleteEnrollment() {
        prefs().edit().clear().apply();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) {
            // Si el Keystore no está disponible, no hay nada que borrar.
        }
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* BOOT_COUNT cambia con cada reinicio del teléfono. Guardamos el valor del
       último desbloqueo: si no coincide, se pide la contraseña una vez. */
    private int bootCount() {
        try {
            return Settings.Global.getInt(
                    getContext().getContentResolver(), Settings.Global.BOOT_COUNT, -1);
        } catch (Exception e) {
            return -1;
        }
    }

    private boolean requiresPasswordAfterReboot() {
        int stored = prefs().getInt(PREF_BOOT_COUNT, -1);
        int current = bootCount();
        return stored >= 0 && current >= 0 && stored != current;
    }

    private void markUnlocked() {
        int current = bootCount();
        if (current >= 0) prefs().edit().putInt(PREF_BOOT_COUNT, current).apply();
    }

    private void fail(PluginCall call, String code, String message) {
        JSObject ret = new JSObject();
        ret.put("ok", false);
        ret.put("code", code);
        ret.put("error", message);
        call.resolve(ret);
    }

    private String invalidatedMessage() {
        return "El desbloqueo biométrico se desactivó porque cambió la biometría del teléfono. "
                + "Ingresa tu contraseña y actívalo de nuevo en Ajustes.";
    }

    private String reasonFor(int can) {
        switch (can) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return "OK";
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "NO_HARDWARE";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "HW_UNAVAILABLE";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "NONE_ENROLLED";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "SECURITY_UPDATE_REQUIRED";
            case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED:
                return "UNSUPPORTED";
            case BiometricManager.BIOMETRIC_STATUS_UNKNOWN:
                return "UNKNOWN";
            default:
                return "UNAVAILABLE";
        }
    }

    private String messageFor(int can) {
        switch (can) {
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "Este teléfono no tiene lector de huellas o cámara compatible.";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "La biometría no está disponible en este momento.";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "Configura una huella o rostro en los ajustes de Android.";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "Actualiza el sistema para usar la biometría.";
            default:
                return "La biometría no está disponible en este teléfono.";
        }
    }

    private String errorCodeFor(int errorCode) {
        switch (errorCode) {
            case BiometricPrompt.ERROR_NEGATIVE_BUTTON:
            case BiometricPrompt.ERROR_USER_CANCELED:
            case BiometricPrompt.ERROR_CANCELED:
                return "CANCELLED";
            case BiometricPrompt.ERROR_LOCKOUT:
            case BiometricPrompt.ERROR_LOCKOUT_PERMANENT:
                return "LOCKOUT";
            default:
                return "AUTH_ERROR";
        }
    }
}
