from celery import shared_task
from PIL import Image
import os
from .models import MediaFile

@shared_task
def compress_media_task(media_id):
    try:
        media = MediaFile.objects.get(id=media_id)
        if media.file_type == 'IMAGE':
            file_path = media.file.path
            img = Image.open(file_path)
            
            # Handle alpha channel conversion
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Save back with optimization and 70% quality
            img.save(file_path, "JPEG", quality=70, optimize=True)
            
            # Update the file size record
            media.file_size = os.path.getsize(file_path)
            media.save()
            print(f"Compressed image media ID {media_id} successfully.")
    except Exception as e:
        print(f"Error compressing media ID {media_id}: {e}")
