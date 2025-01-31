document.addEventListener( "DOMContentLoaded", function () {
  const fileList = document.getElementById( "file-list" );
  const viewer = document.getElementById( "file-content" );
  const canvas = document.getElementById( "dxf-canvas" );
  const ctx = canvas.getContext( "2d" );

  let currentData = null; // Store the current DXF data
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  // Resize canvas to fill the entire <main>
  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    if ( currentData ) drawDXF( currentData ); // Redraw on resize
  }

  window.addEventListener( "resize", resizeCanvas );
  resizeCanvas();

  // Fetch and display file list
  fetch( "/files" )
    .then( ( response ) => response.json() )
    .then( ( files ) => {
      function createFileTree( data ) {
        let ul = document.createElement( "ul" );

        data.forEach( ( item ) => {
          let li = document.createElement( "li" );

          if ( item.type === "folder" ) {
            li.textContent = item.name;
            li.classList.add( "folder" );

            // Add a toggle button for folders
            const toggleButton = document.createElement( "button" );
            toggleButton.textContent = "▼";
            toggleButton.classList.add( "toggle-button" );
            li.prepend( toggleButton );

            let sublist = createFileTree( item.children );
            li.appendChild( sublist );

            // Toggle folder visibility on button click
            toggleButton.addEventListener( "click", function ( e ) {
              e.stopPropagation();
              sublist.style.display = sublist.style.display === "none" ? "block" : "none";
              toggleButton.textContent = sublist.style.display === "none" ? "▶" : "▼";
            } );

            // Expand folders by default
            sublist.style.display = "block";
          } else {
            li.textContent = item.name;
            li.classList.add( "file-item" );
            li.dataset.filename = item.path; // Use the full relative path

            li.addEventListener( "click", function () {
              loadDXF( this.dataset.filename );
            } );
          }

          ul.appendChild( li );
        } );

        return ul;
      }

      fileList.appendChild( createFileTree( files ) );
    } )
    .catch( ( error ) => console.error( "Error loading file list:", error ) );

  // Function to load and display DXF data
  function loadDXF( filename ) {
    console.log( "Loading file:", filename ); // Debug: Log the filename
    const encodedFilename = encodeURIComponent( filename );
    console.log( "Encoded filename:", encodedFilename ); // Debug: Log the encoded filename

    fetch( `/file/${encodedFilename}` )
      .then( ( response ) => {
        if ( !response.ok ) throw new Error( `HTTP error! Status: ${response.status}` );
        return response.json();
      } )
      .then( ( data ) => {
        currentData = data;
        viewer.textContent = JSON.stringify( data, null, 2 );
        drawDXF( data );
      } )
      .catch( ( error ) => {
        console.error( "Error loading DXF file:", error );
        viewer.textContent = `Error loading file: ${error.message}`;
      } );
  }

  // Draw DXF entities on the canvas
  function drawDXF( data ) {
    ctx.clearRect( 0, 0, canvas.width, canvas.height );
    ctx.save();
    ctx.translate( offsetX, offsetY );
    ctx.scale( scale, scale );

    data.entities.forEach( ( entity ) => {
      if ( entity.type === "LINE" ) {
        ctx.beginPath();
        ctx.moveTo( entity.start.x, entity.start.y );
        ctx.lineTo( entity.end.x, entity.end.y );
        ctx.strokeStyle = "black";
        ctx.stroke();
      } else if ( entity.type === "CIRCLE" ) {
        ctx.beginPath();
        ctx.arc( entity.center.x, entity.center.y, entity.radius, 0, Math.PI * 2 );
        ctx.strokeStyle = "blue";
        ctx.stroke();
      }
      // Add more entity types as needed
    } );

    ctx.restore();
  }

  // Add event listeners for zoom and pan
  canvas.addEventListener( "wheel", ( e ) => {
    e.preventDefault();
    scale += e.deltaY * -0.01;
    scale = Math.min( Math.max( 0.1, scale ), 4 ); // Limit scale range
    drawDXF( currentData ); // Redraw with new scale
  } );

  canvas.addEventListener( "mousedown", ( e ) => {
    let startX = e.offsetX;
    let startY = e.offsetY;

    canvas.addEventListener( "mousemove", onMouseMove );
    canvas.addEventListener( "mouseup", () => {
      canvas.removeEventListener( "mousemove", onMouseMove );
    } );

    function onMouseMove( e ) {
      offsetX += e.offsetX - startX;
      offsetY += e.offsetY - startY;
      startX = e.offsetX;
      startY = e.offsetY;
      drawDXF( currentData ); // Redraw with new offset
    }
  } );
} );