      var XHR = new XMLHttpRequest();
      var urlEncodedData = "";
      var urlEncodedDataPairs = [];
      var name,
        data = {
          // imageUrl: img_element.getAttribute("src")
          imageUrl: img_element.dataset.src
        };

      if (data.imageUrl.indexOf("*;base64,") >= 0) return ev.preventDefault();
      // Turn the data object into an array of URL-encoded key/value pairs.
      for (name in data) {
        urlEncodedDataPairs.push(
          encodeURIComponent(name) + "=" + encodeURIComponent(data[name])
        );
      }

      // Combine the pairs into a single string and replace all %-encoded spaces to
      // the '+' character; matches the behaviour of browser form submissions.
      urlEncodedData = urlEncodedDataPairs.join("&").replace(/%20/g, "+");

      XHR.overrideMimeType("text/plain; charset=x-user-defined");
      XHR.addEventListener("load", function(event: any) {
        console.log(event, XHR);
        if (parent_element && XHR.responseText) {
          if (
            XHR.responseText.indexOf("Database does not exist") < 0 &&
            XHR.responseText.indexOf("error") < 0
          ) {
            img_element.remove();
            var responseText = XHR.responseText;
            var responseTextLen = responseText.length;
            var binary = "";
            for (var j = 0; j < responseTextLen; j += 1) {
              binary += String.fromCharCode(responseText.charCodeAt(j) & 0xff);
            }
            let base64Image = "data:image/*;base64," + window.btoa(binary);

            let img = document.createElement("img");
            img.src = base64Image;
            img.style.width = "100%";
            img.style.maxWidth = "400px";
            img.style.verticalAlign = "bottom";
            parent_element.appendChild(img);
          } else {
            img_element.className = "fa fa-exclamation";
            img_element.setAttribute("data-src", "");
            let text = document.createElement("i");
            text.innerHTML = " Image not available.";
            parent_element.appendChild(text);
          }
        }
      });

      XHR.open("POST", "conversation/api/v1/image");
      XHR.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      XHR.send(urlEncodedData);
