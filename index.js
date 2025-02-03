const express = require( "express" );
const cors = require( "cors" );
const fs = require( "fs" );
const path = require( "path" );
const DXFParser = require( "dxf-parser" );
const Drawing = require( "dxf-writer" ); // Import dxf-writer

const app = express();
const PORT = 3000;
const DXF_DIR = path.join( __dirname, "_dxf" );

app.use( cors() );
app.use( express.static( "public" ) );

// Fetch file list
app.get( "/files", ( req, res ) => {
  function getFiles( dir, relativePath = "" ) {
    let results = [];
    fs.readdirSync( dir ).forEach( ( file ) => {
      const fullPath = path.join( dir, file );
      const relPath = path.join( relativePath, file );

      if ( fs.statSync( fullPath ).isDirectory() ) {
        results.push( { name: file, type: "folder", children: getFiles( fullPath, relPath ) } );
      } else if ( file.endsWith( ".dxf" ) ) {
        results.push( { name: file, type: "file", path: relPath } );
      }
    } );
    return results;
  }

  res.json( getFiles( DXF_DIR ) );
} );

// Load and parse DXF file
app.get( "/file/:filename", ( req, res ) => {
  const filename = req.params.filename;
  const filePath = path.join( DXF_DIR, filename );

  if ( !fs.existsSync( filePath ) ) {
    return res.status( 404 ).json( { error: "File not found" } );
  }

  try {
    const dxfContent = fs.readFileSync( filePath, "utf8" );
    const parser = new DXFParser();
    const dxfData = parser.parseSync( dxfContent );

    // Filter for the largest polyline in each block
    dxfData.blocks = Object.fromEntries(
      Object.entries( dxfData.blocks ).map( ( [key, value] ) => {
        if ( value.entities && value.entities.length > 0 ) {
          // Find the polyline with the most vertices
          const largestPolyline = value.entities
            .filter( ( entity ) => entity.type === "POLYLINE" )
            .reduce( ( max, entity ) => ( entity.vertices.length > max.vertices.length ? entity : max ) );

          value.entities = [largestPolyline]; // Keep only the largest polyline
        }
        return [key, value];
      } )
    );

    res.json( dxfData );
  } catch ( error ) {
    console.error( "Error parsing DXF file:", error );
    res.status( 500 ).json( { error: "Error parsing DXF file", details: error.message } );
  }
} );

// Generate and save filtered DXF file
app.post( "/save-dxf", express.json(), ( req, res ) => {
  const { data } = req.body; // Filtered data from client

  if ( !data ) {
    return res.status( 400 ).json( { error: "Data is required" } );
  }

  try {
    const drawing = new Drawing();

    // Add filtered polylines from blocks
    if ( data.blocks ) {
      Object.values( data.blocks ).forEach( ( block ) => {
        block.entities.forEach( ( entity ) => {
          if ( entity.type === "POLYLINE" ) {
            drawing.drawPolyline(
              entity.vertices.map( ( vertex ) => [vertex.x, vertex.y] ),
              entity.shape // true for closed, false for open
            );
          }
        } );
      } );
    }

    // Add filtered polylines from entities (if any)
    if ( data.entities ) {
      data.entities.forEach( ( entity ) => {
        if ( entity.type === "POLYLINE" ) {
          drawing.drawPolyline(
            entity.vertices.map( ( vertex ) => [vertex.x, vertex.y] ),
            entity.shape // true for closed, false for open
          );
        }
      } );
    }

    // Convert the DXF content to a Blob
    const dxfContent = drawing.toDxfString();
    res.setHeader( "Content-Disposition", "attachment; filename=filtered.dxf" );
    res.setHeader( "Content-Type", "application/dxf" );
    res.send( dxfContent );
  } catch ( error ) {
    console.error( "Error saving DXF file:", error );
    res.status( 500 ).json( { error: "Error saving DXF file", details: error.message } );
  }
} );

app.listen( PORT, () => {
  console.log( `Server running at http://localhost:${PORT}` );
} );