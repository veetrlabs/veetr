package com.rnmaps.maps;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.View;
import com.facebook.drawee.backends.pipeline.Fresco;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(manifest=Config.NONE, sdk=28)
public class MarkerBitmapTest {
  private Bitmap render(MapMarker marker) throws Exception {
    java.lang.reflect.Method method = MapMarker.class.getDeclaredMethod("createDrawable");
    method.setAccessible(true);
    return (Bitmap) method.invoke(marker);
  }
  @Test public void fabricMarkerWithoutShadowSizeKeepsEntireHighDensityBoat() throws Exception {
    Context context = RuntimeEnvironment.getApplication();
    Fresco.initialize(context);
    for (int density : new int[]{1,2,3,4}) {
      int size = 112 * density;
      MapMarker marker = new MapMarker(context, null);
      View glyph = new View(context) {
        @Override protected void onDraw(Canvas canvas) {
          Paint p = new Paint(); p.setColor(Color.BLUE);
          canvas.drawCircle(getWidth()/2f,getHeight()/2f,42*density,p);
          p.setColor(Color.BLACK);
          canvas.drawRect(52*density,42*density,60*density,70*density,p);
        }
      };
      marker.addView(glyph,0);
      marker.layout(0,0,size,size);
      glyph.layout(0,0,size,size);
      Bitmap bitmap = render(marker);
      assertEquals(size,bitmap.getWidth()); assertEquals(size,bitmap.getHeight());
      assertEquals(Color.BLACK,bitmap.getPixel(56*density,56*density));
      assertEquals(Color.BLUE,bitmap.getPixel(96*density,56*density));
    }
  }
  @Test public void changingChildBoundsReplacesEarlyFallbackBitmap() throws Exception {
    Context context = RuntimeEnvironment.getApplication(); Fresco.initialize(context);
    MapMarker marker = new MapMarker(context,null);
    View glyph = new View(context); marker.addView(glyph,0);
    assertEquals(100,render(marker).getWidth());
    marker.layout(0,0,336,336); glyph.layout(0,0,336,336);
    assertEquals(336,render(marker).getWidth());
    marker.layout(0,0,224,224); glyph.layout(0,0,224,224);
    assertEquals(224,render(marker).getWidth());
  }
}
