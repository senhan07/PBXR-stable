from playwright.sync_api import sync_playwright
import time
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Capture network requests
        page.on("request", lambda request: print(f">> {request.method} {request.url}"))
        page.on("response", lambda response: print(f"<< {response.status} {response.url}"))

        try:
            print("Navigating to http://localhost:5173/")
            page.goto("http://localhost:5173/", wait_until="networkidle")
            print("Page loaded.")

            # Log in
            page.fill('input[placeholder="Username"]', 'admin')
            page.fill('input[placeholder="Password"]', 'password123')

            print("Clicking login button.")
            page.click('button:has-text("Login")')

            # Wait for navigation to the main page with an extended timeout
            print("Waiting for 'System Overview' heading...")
            page.wait_for_selector("h1:has-text('System Overview')", timeout=60000)
            print("Successfully logged in.")

            # Navigate to Target Management
            page.click('nav >> text=Target Management')
            page.wait_for_selector("h1:has-text('Target Management')", timeout=10000)
            print("Navigated to Target Management.")

            # Create a dummy target to ensure the delete button is available
            page.click('button:has-text("Add Target")')
            page.fill('input[name="name"]', 'dummy-target')
            page.fill('input[name="target"]', 'dummy.com')
            page.select_option('select[name="module"]', 'icmp')
            page.click('button[type="submit"]:has-text("Add")')
            page.wait_for_selector('text=Target added successfully', timeout=10000)
            print("Dummy target created.")

            # Open the delete confirmation modal for the first target in the list
            page.click('tbody tr:first-child button[title="Delete target"]')
            page.wait_for_selector('h2:has-text("Confirm Deletion")', timeout=10000)
            print("Delete confirmation modal opened.")

            # Scroll the page up and down
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1)
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(1)
            print("Scrolled page up and down.")

            # Check if the modal is still visible
            is_visible = page.is_visible('h2:has-text("Confirm Deletion")')
            if is_visible:
                print("SUCCESS: Modal is still visible after scrolling.")
                os.makedirs("/home/jules/verification", exist_ok=True)
                page.screenshot(path="/home/jules/verification/success.png")
            else:
                print("FAILURE: Modal disappeared after scrolling.")
                os.makedirs("/home/jules/verification", exist_ok=True)
                page.screenshot(path="/home/jules/verification/error.png")
                exit(1)

        except Exception as e:
            print(f"An error occurred: {e}")
            os.makedirs("/home/jules/verification", exist_ok=True)
            page.screenshot(path="/home/jules/verification/error.png")
            print("Error screenshot taken.")
            exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
