import os
import pandas as pd

# Create sample_data directory
os.makedirs("sample_data", exist_ok=True)

# 1. SAP Fuel & Procurement CSV (with German column headers and decimal commas)
sap_data = {
    "Buchungsdatum": ["01.03.2026", "15.03.2026", "20.03.2026", "28.03.2026", "05.04.2026"],
    "Materialbezeichnung": [
        "Fleet Diesel Refuel",
        "Erdgas (Natural Gas) Heating",
        "Benzin procurement for generators",
        "Bulk Diesel storage delivery",
        "Future-Dated Fuel Delivery Test"
    ],
    "Menge": ["1500,50", "4200,80", "450,20", "12500,00", "3000,00"],
    "Einheit": ["L", "m3", "ltr", "litres", "L"],
    "Kraftstofftyp": ["diesel", "natural gas", "petrol", "diesel", "diesel"],
    "Buchungskreis": ["DE01", "DE01", "DE02", "DE01", "DE02"],
    "Kostenart": ["Procurement", "Utilities", "Operations", "Procurement", "Procurement"],
    "Werk": ["W102", "W102", "W103", "W102", "W103"]
}
# Note: The last row is future-dated relative to 2026-05-25 (it's 2026-06-05 or similar? Wait, today is 2026-05-25, so "05.04.2026" is in the past. Let's make one future-dated: "15.06.2026")
sap_data["Buchungsdatum"][-1] = "15.06.2026" # Future-dated relative to May 2026

df_sap = pd.DataFrame(sap_data)
df_sap.to_csv("sample_data/sap_raw_export.csv", index=False, encoding="utf-8")

# 2. Utility Electricity CSV
utility_data = {
    "Account Number": ["UT-998213", "UT-998213", "UT-554109", "UT-554109"],
    "Site Name": ["Frankfurt Data Center", "Frankfurt Data Center", "Berlin Office HQ", "Berlin Office HQ"],
    "Site Code": ["W102", "W102", "W103", "W103"],
    "Meter ID": ["MTR-8812", "MTR-8812", "MTR-2041", "MTR-2041"],
    "Billing Period Start": ["2026-01-01", "2026-02-01", "2026-01-15", "2026-02-15"],
    "Billing Period End": ["2026-01-31", "2026-02-28", "2026-02-14", "2026-03-14"],
    "Usage kWh": [85230.50, 91200.75, 4520.10, -500.00],  # Includes a negative usage to trigger the validation flag
    "Tariff": ["Commercial Green", "Commercial Green", "Standard Business", "Standard Business"],
    "Supplier Ref": ["Vattenfall", "Vattenfall", "E.ON", "E.ON"]
}
df_utility = pd.DataFrame(utility_data)
df_utility.to_csv("sample_data/utility_electricity_export.csv", index=False, encoding="utf-8")

# 3. Corporate Travel CSV (Concur/Navan style)
travel_data = {
    "Trip ID": ["TRP-1002", "TRP-1003", "TRP-1004", "TRP-1005"],
    "Employee ID": ["EMP-0249", "EMP-1082", "EMP-0077", "EMP-0077"],
    "Department": ["Sales", "Engineering", "Management", "Management"],
    "Departure Date": ["2026-02-10", "2026-03-01", "2026-03-10", "2026-03-10"],
    "Return Date": ["2026-02-15", "2026-03-08", "2026-03-15", "2026-03-15"],
    "Origin": ["FRA", "BER", "FRA", "FRA"],
    "Destination": ["JFK", "LHR", "HND", "HND"],
    "Travel Class": ["Economy", "Economy", "First", "First"],  # First class triggers low severity flag
    "Distance KM": [6200.00, 950.00, 9300.00, 0.00],
    "Hotel Nights": [5, 7, 5, 0],
    "Hotel City": ["New York", "London", "Tokyo", ""],
    "Taxi KM": [45.20, 12.00, 80.50, 0.00]
}
df_travel = pd.DataFrame(travel_data)
df_travel.to_csv("sample_data/corporate_travel_export.csv", index=False, encoding="utf-8")

print("Created sample CSV files under backend/sample_data/")
