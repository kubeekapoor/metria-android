package com.kubeekapoor.metria;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    @SuppressWarnings("deprecation")
    protected void onCreate(Bundle savedInstanceState) {
        // Los plugins locales se registran antes de crear el puente.
        registerPlugin(MetriaBiometricPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        // Sin esto, algunos gestores de contraseñas no ven los campos del WebView.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
        }
        WebSettings settings = webView.getSettings();
        settings.setSaveFormData(true);
    }
}
