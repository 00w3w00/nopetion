import { afterEach, describe, expect, it, vi } from "vitest";
import { installBlockLongPress } from "./block-long-press";
const pointer=(target:HTMLElement,type:string,x=50,y=100)=>{const event=new Event(type,{bubbles:true});Object.assign(event,{pointerType:'touch',isPrimary:true,pointerId:1,clientX:x,clientY:y});target.dispatchEvent(event);};
afterEach(()=>{vi.useRealTimers();document.body.innerHTML='';});
describe('Touch block access',()=>{
  it('opens once after a deliberate long press and suppresses the resulting click',()=>{
    vi.useFakeTimers();const element=document.createElement('div');document.body.append(element);const open=vi.fn(()=>true),dispose=installBlockLongPress(element,open,()=>true);
    pointer(element,'pointerdown');vi.advanceTimersByTime(549);expect(open).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(open).toHaveBeenCalledWith(50,100);
    pointer(element,'pointerup');const touchEnd=new Event('touchend',{cancelable:true,bubbles:true});element.dispatchEvent(touchEnd);expect(touchEnd.defaultPrevented).toBe(true);
    const click=new MouseEvent('click',{cancelable:true,bubbles:true});element.dispatchEvent(click);expect(click.defaultPrevented).toBe(true);dispose();
  });
  it('keeps ordinary taps, scrolling and inputs untouched and cancels on destroy',()=>{
    vi.useFakeTimers();const element=document.createElement('div'),input=document.createElement('input');element.append(input);document.body.append(element);const open=vi.fn(()=>true),dispose=installBlockLongPress(element,open,()=>true);
    pointer(element,'pointerdown');pointer(element,'pointerup');vi.advanceTimersByTime(600);
    const ordinaryEnd=new Event('touchend',{cancelable:true,bubbles:true});element.dispatchEvent(ordinaryEnd);expect(ordinaryEnd.defaultPrevented).toBe(false);
    pointer(element,'pointerdown');pointer(element,'pointermove',50,109);vi.advanceTimersByTime(600);
    pointer(input,'pointerdown');vi.advanceTimersByTime(600);
    pointer(element,'pointerdown');window.dispatchEvent(new Event('scroll'));vi.advanceTimersByTime(600);
    pointer(element,'pointerdown');dispose();vi.advanceTimersByTime(600);expect(open).not.toHaveBeenCalled();
  });
  it('cannot operate on a read-only editor or one that becomes read-only',()=>{
    vi.useFakeTimers();const element=document.createElement('div');document.body.append(element);let editable=false;const open=vi.fn(()=>true),dispose=installBlockLongPress(element,open,()=>editable);
    pointer(element,'pointerdown');vi.advanceTimersByTime(600);editable=true;pointer(element,'pointerdown');editable=false;vi.advanceTimersByTime(600);expect(open).not.toHaveBeenCalled();dispose();
  });
});
