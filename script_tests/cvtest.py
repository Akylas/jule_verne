import cv2
import numpy as np
import sys
import os

def cropImage(path):
    img = cv2.imread(path)
    grayscale = cv2.resize(img, (228, 192), interpolation = cv2.INTER_AREA)
    grayscale = cv2.bitwise_not(grayscale)
    y_nonzero, x_nonzero, _ = np.nonzero(grayscale)
    x = np.min(y_nonzero)
    w = np.max(y_nonzero)
    y = np.min(x_nonzero) 
    h = np.max(x_nonzero)
    croppedImg = grayscale[x:w, y:h]
    croppedImg = cv2.cvtColor(croppedImg, cv2.COLOR_BGR2GRAY)

    cv2.imshow("foreground.png", croppedImg)
    cv2.waitKey(0) # waits until a key is pressed
    cv2.destroyAllWindows() # destroys the window showing image
# read graysclae img
def RLE_encoding(img, bits=8,  binary=True):
    """
    img: Grayscale img.
    bits: what will be the maximum run length? 2^bits
    """
    if binary:
        ret,img = cv2.threshold(img,127,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)

    encoded = []
    shape=img.shape
    count = 0
    prev = None
    fimg = img.flatten()
    th=127
    for pixel in fimg:
        if binary:
            if pixel<th:
                pixel=0
            else:
                pixel=1
        if prev==None:
            prev = pixel
            count+=1
        else:
            if prev!=pixel:
                encoded.append((count, prev))
                prev=pixel
                count=1
            else:
                if count<(2**bits)-1:
                    count+=1
                else:
                    encoded.append((count, prev))
                    prev=pixel
                    count=1
    encoded.append((count, prev))
    
    return np.array(encoded)

# decode
def RLE_decode(encoded, shape):
    decoded=[]
    for rl in encoded:
        r,p = rl[0], rl[1]
        decoded.extend([p]*r)
    dimg = np.array(decoded).reshape(shape)
    return dimg

def get_size(filename="dd.png"):
    stat = os.stat(filename)
    size=stat.st_size
    return size

img = cv2.imread("/Volumes/data/dev/nativescript/jule_verne/app/assets/data/waiting/stories/2/images/chambredhotel1.bmp")

cropImage();
# img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
shape=img.shape
encoded = RLE_encoding(img, bits=8, binary=False)
dimg = RLE_decode(encoded, shape)
# save the encoded list into npz array file
earr=np.array(encoded)
# earr=earr.astype(np.uint8)
np.savez("np2.npz", earr)
cv2.imwrite("encoded1.tif", earr)
cv2.imwrite("encoded1.png", earr)
print(get_size("np2.npz"))
print(get_size("/Volumes/data/dev/nativescript/jule_verne/app/assets/data/waiting/stories/2/images/chambredhotel1.bmp"))
cv2.imshow("foreground.png", dimg)
cv2.waitKey(0) # waits until a key is pressed
cv2.destroyAllWindows() # destroys the window showing image