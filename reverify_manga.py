import asyncio
from playwright.async_api import async_playwright
import time
import os

async def verify_manga_flow():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Adding orderid and name to bypass auth
        url = "http://localhost:3002/?orderid=test&name=test"

        try:
            print(f"Navigating to {url}")
            await page.goto(url)
            print(f"Page title: {await page.title()}")

            # Wait for content
            await page.wait_for_load_state("networkidle")

            # Look for the welcome text
            welcome_text = page.locator("text=さぁ、ガイダンスに沿って")
            await welcome_text.wait_for(state="visible", timeout=10000)
            print("Step 0: Welcome screen confirmed.")

            # Step 1: explain1.png
            await page.click("button:has-text('次へ')")
            await asyncio.sleep(1.0) # Increased sleep for safety
            img1 = page.locator("img[src*='explain1.png']")
            await img1.wait_for(state="visible", timeout=5000)
            print("Step 1: explain1.png confirmed.")

            # Step 2: explain2.png
            await page.click("button:has-text('次へ')")
            await asyncio.sleep(1.0)
            img2 = page.locator("img[src*='explain2.png']")
            await img2.wait_for(state="visible", timeout=5000)
            print("Step 2: explain2.png confirmed.")

            # Step 3: explain3.png
            await page.click("button:has-text('次へ')")
            await asyncio.sleep(1.0)
            img3 = page.locator("img[src*='explain3.png']")
            await img3.wait_for(state="visible", timeout=5000)
            print("Step 3: explain3.png confirmed.")

            # Step 4: explain4.png + "カメラ起動"
            await page.click("button:has-text('次へ')")
            await asyncio.sleep(1.0)
            img4 = page.locator("img[src*='explain4.png']")
            await img4.wait_for(state="visible", timeout=5000)
            btn_final = page.locator("button:has-text('カメラ起動')")
            await btn_final.wait_for(state="visible", timeout=5000)
            print("Step 4: explain4.png and 'カメラ起動' button confirmed.")

            os.makedirs("/home/jules/verification", exist_ok=True)
            await page.screenshot(path="/home/jules/verification/reverified_final.png")
            print("Verification successful.")

        except Exception as e:
            print(f"Verification failed: {e}")
            os.makedirs("/home/jules/verification", exist_ok=True)
            await page.screenshot(path="/home/jules/verification/reverify_failure.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_manga_flow())
