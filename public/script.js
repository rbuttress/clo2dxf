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
    fetch( `/file/${encodeURIComponent( filename )}` )
      .then( ( response ) => {
        if ( !response.ok ) throw new Error( `HTTP error! Status: ${response.status}` );
        return response.json();
      } )
      .then( ( data ) => {
        currentData = data;
        viewer.textContent = JSON.stringify( data, null, 2 );
        console.log( "DXF Data:", data ); // Debug: Log the DXF data
        drawDXF( data );
      } )
      .catch( ( error ) => {
        console.error( "Error loading DXF file:", error );
        viewer.textContent = `Error loading file: ${error.message}`;
      } );
  }
  function calculateBoundingBox( data ) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Iterate through all blocks and their entities
    if ( data.blocks ) {
      Object.values( data.blocks ).forEach( ( block ) => {
        block.entities.forEach( ( entity ) => {
          if ( entity.type === "POLYLINE" ) {
            entity.vertices.forEach( ( vertex ) => {
              minX = Math.min( minX, vertex.x );
              minY = Math.min( minY, vertex.y );
              maxX = Math.max( maxX, vertex.x );
              maxY = Math.max( maxY, vertex.y );
            } );
          }
        } );
      } );
    }

    return { minX, minY, maxX, maxY };
  }

  // Draw DXF entities on the canvas
  function drawDXF( data ) {
    ctx.clearRect( 0, 0, canvas.width, canvas.height );
    ctx.save();

    // Calculate the bounding box
    const bbox = calculateBoundingBox( data );

    // Calculate the center of the bounding box
    const centerX = ( bbox.minX + bbox.maxX ) / 2;
    const centerY = ( bbox.minY + bbox.maxY ) / 2;

    // Calculate the width and height of the bounding box
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;

    // Calculate the scaling factor to fit the drawing within the canvas
    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const scale = Math.min( scaleX, scaleY ) * 0.9; // Add some padding (10%)

    // Translate to center the drawing
    ctx.translate( canvas.width / 2, canvas.height / 2 );
    ctx.scale( scale, -scale ); // Flip Y-axis to match DXF coordinates
    ctx.translate( -centerX, -centerY );

    // Draw sample data (if provided)
    if ( data.entities ) {
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
      } );
    }

    // Draw POLYLINE entities from blocks
    if ( data.blocks ) {
      Object.values( data.blocks ).forEach( ( block ) => {
        block.entities.forEach( ( entity ) => {
          if ( entity.type === "POLYLINE" ) {
            drawPolyline( entity );
          }
        } );
      } );
    }

    ctx.restore();
  }

  // Helper function to draw POLYLINE entities
  function drawPolyline( polyline ) {
    ctx.beginPath();
    ctx.strokeStyle = "black"; // Default color
    ctx.lineWidth = 1;

    polyline.vertices.forEach( ( vertex, index ) => {
      if ( index === 0 ) {
        ctx.moveTo( vertex.x, vertex.y );
      } else {
        ctx.lineTo( vertex.x, vertex.y );
      }
    } );

    // Close the polyline if it's a closed shape
    if ( polyline.shape ) {
      ctx.closePath();
    }

    ctx.stroke();
  }

  const sampleData = {
    entities: [
      { type: "LINE", start: { x: 50, y: 50 }, end: { x: 200, y: 200 } },
      { type: "CIRCLE", center: { x: 150, y: 150 }, radius: 50 },
    ],
  };
  drawDXF( sampleData );

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