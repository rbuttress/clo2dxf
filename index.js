const express = require( "express" );
const cors = require( "cors" );
const fs = require( "fs" );
const path = require( "path" );
const DXFParser = require( "dxf-parser" );

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
  console.log( "Requested filename:", filename ); // Debug: Log the requested filename

  // Validate filename to prevent directory traversal
  if ( filename.includes( ".." ) ) { // Only block paths containing ".."
    console.error( "Invalid filename detected:", filename ); // Debug: Log invalid filename
    return res.status( 400 ).json( { error: "Invalid filename" } );
  }

  const filePath = path.join( DXF_DIR, filename );
  console.log( "Resolved file path:", filePath ); // Debug: Log the resolved file path

  if ( !fs.existsSync( filePath ) ) {
    console.error( "File not found:", filePath ); // Debug: Log file not found
    return res.status( 404 ).json( { error: "File not found" } );
  }

  try {
    const dxfContent = fs.readFileSync( filePath, "utf8" );
    const parser = new DXFParser();
    const dxfData = parser.parseSync( dxfContent );

    // Filter to isolate the largest polyline in each block
    dxfData.blocks = Object.fromEntries(
      Object.entries( dxfData.blocks ).map( ( [key, value] ) => {
        let entities = value.entities.filter( ( entity ) => entity.type === "POLYLINE" );

        if ( entities.length > 1 ) {
          entities = [entities.reduce( ( max, entity ) => ( entity.vertices.length > max.vertices.length ? entity : max ) )];
        }

        return [key, { ...value, entities }];
      } )
    );

    // Filter INSERT entities in the main DXF data
    dxfData.entities = dxfData.entities.filter( ( entity ) => entity.type === "INSERT" );

    res.json( dxfData );
  } catch ( error ) {
    console.error( "Error parsing DXF file:", error ); // Debug: Log parsing errors
    res.status( 500 ).json( { error: "Error parsing DXF file", details: error.message } );
  }
} );

app.listen( PORT, () => {
  console.log( `Server running at http://localhost:${PORT}` );
} );