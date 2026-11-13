package com.kanhasoft.erp;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;

/**
 * Kanha Software Solution — Enterprise Java ERP Bridge & Diagnostics Client (v2.5.1d)
 */
public class KanhaErpApplication {

    public static void main(String[] args) {
        String serverUrl = System.getenv().getOrDefault("ERP_SERVER_URL", "http://localhost:3000");
        System.out.println("==================================================================");
        System.out.println("  KANHA SOFTWARE SOLUTION - JAVA ENTERPRISE ERP BRIDGE (v2.5.1d)  ");
        System.out.println("==================================================================");
        System.out.println("  Target POS Server : " + serverUrl);

        try {
            URL url = URI.create(serverUrl + "/api/health").toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);

            int status = conn.getResponseCode();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                System.out.println("  Server Status (" + status + "): " + sb);
            }
        } catch (Exception ex) {
            System.out.println("  Server Status     : Offline / Standalone Local Vault Mode (" + ex.getMessage() + ")");
        }
        System.out.println("==================================================================");
    }
}
