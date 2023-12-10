const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

// Comment/Un-comment these lines (this is dev environment code)
// const frontendPublicDirectory = path.join(
//   __dirname,
//   "../frontend/CDV-Test/public"
// );
// const frontendDirectory = path.join(__dirname, "../frontend/CDV-Test");
// const indexPath = path.join(frontendDirectory, "index.html");

// connect to frontend build assets
const frontendBaseUrl =
  process.env.FRONTEND_BUILD_PATH ||
  path.join(__dirname, "../frontend/CDV-Test"); // Replace with your actual deployed URL

const frontendPublicDirectory = path.join(`${frontendBaseUrl}`, `/public`);
// Use the base URL to construct URLs for assets
const indexPath = `${frontendBaseUrl}/index.html`;

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseApiKey = process.env.SUPABASE_API_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME;
const supabase = createClient(supabaseUrl, supabaseApiKey);

const allowedOrigins = ["https://main--tubular-piroshki-132d7c.netlify.app"];
const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));
// app.use(cors());

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

// const reactAppDirectory = path.join(__dirname, indexPath);
const reactAppDirectory = path.join(frontendBaseUrl, "");

app.use(express.static(reactAppDirectory));

app.use(express.json());

app.get("*", (req, res) => {
  res.sendFile(path.join(reactAppDirectory, ""));
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
    console.log("page var");
    const page = await browser.newPage();
    console.log("got page var");
    await page.goto(`${indexPath}`, {
      waitUntil: "networkidle2",
    });
    console.log("awaiting finished");
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
    // const screenshotPath = path.join(frontendPublicDirectory, fileName);

    // Save the screenshot using the constructed filename
    // fs.writeFileSync(screenshotPath, screenshot);

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