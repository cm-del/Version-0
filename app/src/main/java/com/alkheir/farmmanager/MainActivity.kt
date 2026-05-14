package com.alkheir.farmmanager

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.alkheir.farmmanager.ui.theme.PoultryTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PoultryTheme {
                AppNavGraph()
            }
        }
    }
}

@Composable
private fun AppNavGraph() {
    val navController = rememberNavController()
    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "home",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("home") {
                HomeScreen(onOpenDailyLog = { navController.navigate("dailyLog") })
            }
            composable("dailyLog") { DailyLogScreen() }
        }
    }
}

@Composable
private fun HomeScreen(onOpenDailyLog: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(text = stringResource(R.string.app_name), style = MaterialTheme.typography.headlineSmall)
        Text(text = stringResource(R.string.welcome_message))
        Button(onClick = onOpenDailyLog) {
            Text(text = stringResource(R.string.open_daily_log))
        }
    }
}

@Composable
private fun DailyLogScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
    ) {
        Text(text = stringResource(R.string.daily_log_title), style = MaterialTheme.typography.headlineSmall)
        Text(text = stringResource(R.string.daily_log_hint))
    }
}

@Preview(showBackground = true)
@Composable
private fun HomeScreenPreview() {
    PoultryTheme {
        HomeScreen(onOpenDailyLog = {})
    }
}
