package com.rero.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.rero.app.widget.StreakWidgetPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StreakWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
