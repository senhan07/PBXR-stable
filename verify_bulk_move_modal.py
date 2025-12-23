from playwright.sync_api import sync_playwright
import time
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Login
            page.goto("http://localhost:5173/")
            page.wait_for_load_state('networkidle')
            page.fill('input[placeholder="Username"]', 'admin')
            page.fill('input[placeholder="Password"]', 'password123')
            page.click('button:has-text("Login")')
            page.wait_for_selector("h1:has-text('System Overview')", timeout=90000)
            print("Successfully logged in.")

            # Navigate to Target Management
            page.click('nav >> text=Target Management')
            page.wait_for_selector("h1:has-text('Target Management')", timeout=10000)
            print("Navigated to Target Management.")

            # Add two dummy targets to select
            for i in range(2):
                page.click('button:has-text("New Target")')
                page.wait_for_selector('h3:has-text("New Target")')
                page.fill('input[placeholder="e.g. Production API"]', f'dummy-target-{i}')
                page.fill('input[placeholder="https://example.com"]', f'dummy-{i}.com')
                # Select the first prober
                page.check('input[type="checkbox"]', force=True)
                page.click('button:has-text("Create Target")')
                page.wait_for_selector(f'text=dummy-target-{i}', timeout=10000)
                print(f"Dummy target {i+1} created.")

            # Select the two targets
            page.check('tbody tr:nth-child(1) input[type="checkbox"]', force=True)
            page.check('tbody tr:nth-child(2) input[type="checkbox"]', force=True)
            page.wait_for_selector('text=2 Selected')
            print("Selected 2 targets.")

            # Open the bulk move modal
            page.click('button:has-text("Move")')
            page.wait_for_selector('h3:has-text("Move 2 items to...")')
            print("Bulk move modal opened.")

            # Take screenshot before scroll
            os.makedirs("/home/jules/verification", exist_ok=True)
            page.screenshot(path="/home/jules/verification/before_scroll.png")

            # Scroll the page up and down
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1)
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(1)
            print("Scrolled page up and down.")

            # Check if the modal is still visible
            is_visible = page.is_visible('h3:has-text("Move 2 items to...")')
            if is_visible:
                print("SUCCESS: Bulk move modal is still visible after scrolling.")
                page.screenshot(path="/home/jules/verification/success.png")
            else:
                print("FAILURE: Bulk move modal disappeared after scrolling.")
                page.screenshot(path="/home/jules/verification/error.png")
                exit(1)

        except Exception as e:
            print(f"An error occurred: {e}")
            os.makedirs("/home/jules/verification", exist_ok=True)
            page.screenshot(path="/home/jules/verification/error_bulk_move.png")
            exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
