const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();
const frontendPublicDirectory = path.join(
  __dirname,
  "../frontend/CDV-Test/public"
);
const frontendDirectory = path.join(__dirname, "../frontend/CDV-Test");
const indexPath = path.join(frontendDirectory, "index.html");

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = "https://enssmnohepficaxcmyjb.supabase.co";
const supabaseApiKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuc3Ntbm9oZXBmaWNheGNteWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTY5Nzk4MDgsImV4cCI6MjAxMjU1NTgwOH0.asLCggvlojyU2WlGmlAUAaNjC2LDEYHIyicJynvFkVk";
const bucketName = "cdvuploads";
const supabase = createClient(supabaseUrl, supabaseApiKey);

app.use(cors());

app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res, path) => {
      if (path.endsWith(".js")) {
        res.setHeader(
          "Content-Type",
          path.endsWith(".mjs") ? "module/javascript" : "text/javascript"
        );
      }
    },
  })
);

app.use(
  express.static(__dirname, {
    setHeaders: (res, path) => {
      if (path.endsWith(".js")) {
        res.setHeader(
          "Content-Type",
          path.endsWith(".mjs") ? "module/javascript" : "text/javascript"
        );
      }
    },
  })
);

app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));

const reactAppDirectory = path.join(
  __dirname,
  "../frontend/CDV-TEST/index.html"
);

app.use(express.static(reactAppDirectory));

app.use(express.json());

app.get("*", (req, res) => {
  res.sendFile(path.join(reactAppDirectory, "index.html"));
});

app.post("/convert", async (req, res) => {
  try {
    console.log("Convert request received");
    console.log(req.body);
    const { inputFieldValues } = req.body;
    console.log(inputFieldValues);
    const browser = await puppeteer.launch({
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(`file://${indexPath}`, {
      waitUntil: "networkidle2",
    });
    for (const inputFieldId in inputFieldValues) {
      if (inputFieldValues.hasOwnProperty(inputFieldId)) {
        const inputValue = inputFieldValues[inputFieldId];
        await page.evaluate(
          (id, value) => {
            const inputField = document.getElementById(id);
            if (inputField) {
              inputField.value = value;
            }
          },
          inputFieldId,
          inputValue
        );
      }
    }

    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 100,
      fullPage: true,
    });

    const fileName =
      inputFieldValues.driverFirstName +
      inputFieldValues.driverLastName +
      ".jpg";

    console.log(fileName);

    // Define the path where you want to save the screenshot
    const screenshotPath = path.join(frontendPublicDirectory, fileName);

    // Save the screenshot using the constructed filename
    fs.writeFileSync(screenshotPath, screenshot);

    // Create a Blob from the image data
    const screenshotBlob = new Blob([screenshot]);

    // Create a FormData object
    const formData = new FormData();

    // Append the Blob to the FormData object
    formData.append("file", screenshotBlob, fileName);

    // Set additional options
    formData.append("cacheControl", "3600");
    formData.append("upsert", "false");
    formData.append("contentType", "image/jpeg");

    // Send the FormData to Supabase
    const response = await supabase.storage
      .from("cdvuploads") // Replace with your Supabase storage bucket name
      .upload(fileName, formData);

    if (response.error) {
      console.error("Error:", response.error.message);
      res.status(500).send("Internal Server Error");
    } else {
      console.log("Image uploaded to Supabase successfully");
      res.status(200).send("Webpage converted to JPG");
    }

    // Close the browser
    await browser.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.use(express.static("public"));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});