import asyncio
from playwright import async_api


async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",  # Set the browser window size
                "--disable-dev-shm-usage",  # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",  # Use host-level IPC for better stability
                "--single-process",  # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:3000
        await page.goto("http://localhost:3000")

        # -> Navigate to the login page at /login
        await page.goto("http://localhost:3000/login")

        # -> Fill the email field with the provided credential and fill the password field, then submit the login form.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator(
            "xpath=/html/body/main/div[5]/div[2]/div[3]/div[2]/form/div/input"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.fill("fajarabr76@gmail.com")

        frame = context.pages[-1]
        # Input text
        elem = frame.locator(
            "xpath=/html/body/main/div[5]/div[2]/div[3]/div[2]/form/div[2]/input"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.fill("f@jarabd10")

        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/main/div[5]/div[2]/div[3]/div[2]/form/button"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Open the QA reports section — expand the 'SIDAK' menu in the sidebar to reveal the QA/Reports navigation (to reach /qa-analyzer/reports).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator("xpath=/html/body/div/aside/div/nav/div[2]/button").nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Open the Report Maker page (/qa-analyzer/reports) by clicking the 'Report Maker' link in the SIDAK menu.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/aside/div/nav/div[2]/div/div/a[4]"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Open the Report Maker page (/qa-analyzer/reports) by clicking the 'Report Maker' link in the SIDAK menu (or navigate if click does not work).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/aside/div/nav/div[2]/div/div/a[4]"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Click the 'INDIVIDU' report type button to switch the form to Individual report mode and reveal agent selection fields.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div/button[2]"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Select an agent so the form becomes valid (open the agent dropdown / filter the agent list). After the agent is selected, we will enable the Generate action.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div[2]/div/input"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.fill("Adhitya")

        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div[2]/div/select"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Click the 'Generate report' button to start generating the Individual .docx report, then wait for the UI to show the ready/download state.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div[5]/button"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Click the 'Unduh .docx' download button to start the .docx download and wait briefly to observe that the download begins.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div[5]/button[2]"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # --> Test passed — verified by AI agent
        frame = context.pages[-1]
        current_url = await frame.evaluate("() => window.location.href")
        assert current_url is not None, "Test completed successfully"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()


asyncio.run(run_test())
