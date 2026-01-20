import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime, timezone
import os

URLS = {
    "master": "https://commaai.github.io/model_reports/master/analyse_branch.html",
    "wmi": "https://commaai.github.io/model_reports/a27b3122-733e-4a65-938b-acfebebbe5e8/100/analyse_branch.html",
}


def clean_text(text):
    return " ".join(text.split()).strip()


def extract_int(pattern, text, default=0):
    match = re.search(pattern, text)
    return int(match.group(1)) if match else default


def extract_engagement_section(section_name, text):
    section_start = text.find(f"Engagement Rate Analysis ({section_name})")
    if section_start == -1:
        return None
    
    section_text = text[section_start:section_start + 500]
    
    extract_overall = re.search(r"Overall engagement rate:\s*([\d\.]+)%\s*\(([^\)]+)\)", section_text)
    if not extract_overall:
        return None
    
    extract_chill = re.search(r"Chill mode:\s*([\d\.]+)%\s*\(([^\)]+)\)", section_text)
    extract_exp = re.search(r"Experimental mode:\s*([\d\.]+)%\s*\(([^\)]+)\)", section_text)
    
    return {
        "title": f"Engagement Rate Analysis ({section_name})",
        "overall": float(extract_overall.group(1)) if extract_overall else 0.0,
        "overall_detail": extract_overall.group(2) if extract_overall else "",
        "chill_mode": float(extract_chill.group(1)) if extract_chill else 0.0,
        "chill_mode_detail": extract_chill.group(2) if extract_chill else "",
        "experimental_mode": float(extract_exp.group(1)) if extract_exp else 0.0,
        "experimental_mode_detail": extract_exp.group(2) if extract_exp else "",
    }


def parse_page(url):
    print(f"Fetching {url}...")
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        data = {"metadata": {}, "segments": {}, "sections": {}, "tables": {}}

        h1 = soup.find("h1")
        page_title = None
        branch_name = None
        if h1:
            page_title = clean_text(h1.get_text())
            # Extract first branch name from brackets
            bracket_match = re.search(r"\['([^']+)'", page_title)
            branch_name = bracket_match.group(1) if bracket_match else None

        body_text = soup.get_text()

        data["metadata"]["page_title"] = page_title
        data["metadata"]["url"] = url
        data["metadata"]["branch_name"] = branch_name
        
        data["segments"]["total"] = extract_int(r"Total segments:\s*(\d+)", body_text)
        data["segments"]["chill_mode"] = extract_int(r"Chill mode segments:\s*(\d+)", body_text)
        data["segments"]["experimental_mode"] = extract_int(r"Experimental mode segments:\s*(\d+)", body_text)

        engagement_time = extract_engagement_section("time", body_text)
        if engagement_time:
            data["sections"]["engagement_time"] = engagement_time

        engagement_distance = extract_engagement_section("distance", body_text)
        if engagement_distance:
            data["sections"]["engagement_distance"] = engagement_distance

        for i, table in enumerate(soup.select("table")):
            # Get the title from previous H2
            prev_h2 = table.find_previous("h2")
            title = clean_text(prev_h2.get_text()) if prev_h2 else f"Table {i + 1}"

            rows = table.select("tr")
            if not rows:
                continue

            headers = [clean_text(th.get_text()) for th in rows[0].select("th, td")]

            table_rows = []
            for row in rows[1:]:
                cells = row.select("td")
                if not cells:
                    continue
                row_obj = {
                    headers[j]: clean_text(cells[j].get_text())
                    for j in range(min(len(headers), len(cells)))
                }
                if row_obj:
                    table_rows.append(row_obj)

            # Use descriptive key if possible, else index
            key = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_") or f"table_{i}"
            data["tables"][key] = {
                "title": title,
                "headers": headers,
                "rows": table_rows,
            }

        return data

    except Exception as e:
        print(f"Error parsing {url}: {e}")
        return None


def main():
    results_path = "public/data.json"
    results = {"timestamp": datetime.now(timezone.utc).isoformat(), "data": {}}
    
    os.makedirs("public", exist_ok=True)
    
    success_count = 0
    
    for branch, url in URLS.items():
        try:
            parsed_data = parse_page(url)
            if parsed_data:
                results["data"][branch] = parsed_data
                success_count += 1
        except Exception as e:
            print(f"Error checking {branch}: {e}")
    
    if success_count > 0:
        with open(results_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"Successfully updated {results_path}")
    else:
        print("No data scraped successfully.")
        exit(1)


if __name__ == "__main__":
    main()
